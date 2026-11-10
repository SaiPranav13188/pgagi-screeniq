"""PDF -> clean text blocks -> structure-aware, overlapping chunks.

Design notes (see README "Chunking strategy"):

* **Layout-aware extraction.** PyMuPDF gives us text *blocks* with font sizes, so we can
  detect section headings (spans noticeably larger than the body font) instead of
  splitting blindly every N characters.
* **Noise removal.** Running headers/footers (lines that repeat on many pages, page
  numbers), ligatures and hyphenated line breaks are cleaned so they do not pollute
  embeddings.
* **Section boundaries are hard boundaries.** A chunk never spans two sections, which
  keeps each chunk about one idea and makes the section title a reliable label.
* **Paragraph packing with sentence overlap.** Paragraphs are packed up to a target
  size (~230 words, comfortably under bge-small's 512-token window); the last couple of
  sentences are carried into the next chunk so definitions that straddle a boundary
  are not lost.
* **Quality gate.** Table-of-contents, index, bibliography and equation-only fragments
  are dropped - they retrieve well lexically but are useless for question generation.
"""
from __future__ import annotations

import hashlib
import re
from collections import Counter
from dataclasses import asdict, dataclass

import fitz  # PyMuPDF

LIGATURES = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "’": "'", "‘": "'",
             "“": '"', "”": '"', "–": "-", "—": " - ", " ": " ", "•": "-"}
# Back matter is skipped until the next heading; front matter only for a few pages,
# because some books have no detectable headings after their table of contents.
BACK_MATTER_RE = re.compile(r"^(index|bibliography|references|further reading)\b", re.I)
FRONT_MATTER_RE = re.compile(
    r"^(contents|table of contents|acknowledg|copyright|about the author|preface|foreword|dedication|"
    r"list of (figures|tables))\b",
    re.I,
)
FRONT_MATTER_MAX_PAGES = 4
CODE_CHARS = set("=(){}[]<>_#;/\\*+|$@^~`")
SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z(\"'])")


@dataclass
class Chunk:
    id: str
    book_id: str
    text: str
    section: str
    page_start: int
    page_end: int
    chunk_index: int
    word_count: int

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class _Block:
    text: str
    page: int
    is_heading: bool
    size: float


def dehyphenate(text: str) -> str:
    """Repair words split across lines ("informa- tion" -> "information") while keeping
    real compounds ("general- to-specific" -> "general-to-specific")."""
    text = re.sub(r"([a-z])-\s+(and|or|to|vs)\b", r"\1-\2", text)
    return re.sub(r"([a-z])-\s+([a-z])", r"\1\2", text)


def _clean(text: str) -> str:
    for k, v in LIGATURES.items():
        text = text.replace(k, v)
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # de-hyphenate across line breaks
    text = re.sub(r"[�\x00-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    text = re.sub(r"[ \t]*\n[ \t]*", " ", text)
    return dehyphenate(re.sub(r"\s{2,}", " ", text).strip())


def _norm_line(line: str) -> str:
    return re.sub(r"\d+", "#", line.strip().lower())[:60]


def _body_font_size(doc: fitz.Document) -> float:
    sizes: Counter[float] = Counter()
    step = max(1, doc.page_count // 40)
    for pno in range(0, doc.page_count, step):
        for b in doc[pno].get_text("dict")["blocks"]:
            for line in b.get("lines", []):
                for span in line["spans"]:
                    if len(span["text"].strip()) > 3:
                        sizes[round(span["size"], 1)] += len(span["text"])
    return sizes.most_common(1)[0][0] if sizes else 10.0


def _repeating_lines(doc: fitz.Document) -> set[str]:
    """Header/footer lines: first/last lines that recur on >4% of pages."""
    counter: Counter[str] = Counter()
    for page in doc:
        lines = [l for l in page.get_text().splitlines() if l.strip()]
        for l in lines[:2] + lines[-2:]:
            counter[_norm_line(l)] += 1
    threshold = max(4, int(doc.page_count * 0.04))
    return {l for l, c in counter.items() if c >= threshold}


def extract_blocks(path: str) -> list[_Block]:
    doc = fitz.open(path)
    body = _body_font_size(doc)
    repeating = _repeating_lines(doc)
    blocks: list[_Block] = []
    for pno, page in enumerate(doc, start=1):
        for b in page.get_text("dict")["blocks"]:
            if b.get("type") != 0:
                continue
            lines_txt, sizes, bold = [], [], 0
            for line in b["lines"]:
                lt = "".join(s["text"] for s in line["spans"])
                if _norm_line(lt) in repeating or re.fullmatch(r"\s*\d{1,4}\s*", lt):
                    continue
                lines_txt.append(lt)
                for s in line["spans"]:
                    if s["text"].strip():
                        sizes.append(s["size"])
                        bold += 1 if (s["flags"] & 16) else 0
            raw = "\n".join(lines_txt)
            text = _clean(raw)
            if not text:
                continue
            size = max(sizes) if sizes else body
            words = len(text.split())
            letters = sum(c.isalpha() for c in text)
            is_heading = (
                words <= 14
                and len(text) >= 3
                and letters >= 3
                and letters / max(1, len(text.replace(" ", ""))) >= 0.8
                and not any(ch in text for ch in "=+{}[]<>|$")
                and (size >= body * 1.18 or (bold and bold == len(sizes) and words <= 8 and size >= body * 0.98))
                and not text.endswith((".", ",", ";"))
            )
            blocks.append(_Block(text, pno, is_heading, size))
    doc.close()
    return blocks


def _quality_ok(text: str) -> bool:
    words = text.split()
    if len(words) < 40:
        return False
    alpha = sum(c.isalpha() for c in text) / max(1, len(text))
    if alpha < 0.62:  # equations, tables, code dumps
        return False
    symbols = sum(c in CODE_CHARS for c in text) / max(1, len(text))
    if symbols > 0.035:  # source code / formula dumps
        return False
    if len(re.findall(r"\b(?:import|def|print|return)\b|\w\.\w+\(|\w\[['\":]", text)) > 3:
        return False
    digits = sum(c.isdigit() for c in text) / max(1, len(text))
    if digits > 0.12:  # index / TOC pages
        return False
    if text.count("....") > 3 or len(re.findall(r"\b\d{1,4},\s*\d{1,4}\b", text)) > 8:
        return False
    long_words = sum(1 for w in words if len(w) > 3)
    return long_words / len(words) > 0.35


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in SENT_SPLIT_RE.split(text) if s.strip()]


def chunk_book(path: str, book_id: str, target_words: int = 230, max_words: int = 320, overlap_sentences: int = 2) -> list[Chunk]:
    blocks = extract_blocks(path)
    chunks: list[Chunk] = []
    section = "Introduction"
    skip_section = False
    skip_until_page = 0
    buf: list[str] = []
    buf_pages: list[int] = []

    def flush(carry: bool) -> None:
        nonlocal buf, buf_pages
        text = " ".join(buf).strip()
        if text and not skip_section and buf_pages and min(buf_pages) > skip_until_page and _quality_ok(text):
            cid = hashlib.sha1(f"{book_id}:{len(chunks)}:{text[:80]}".encode()).hexdigest()[:16]
            # A front-matter heading that "expired" is not a meaningful label for body text.
            label = "" if FRONT_MATTER_RE.match(section) else section[:120]
            chunks.append(Chunk(cid, book_id, text, label, min(buf_pages), max(buf_pages), len(chunks), len(text.split())))
        if carry and text:
            tail = _sentences(text)[-overlap_sentences:] if overlap_sentences else []
            tail_text = " ".join(tail)
            if len(tail_text.split()) > 80:  # never carry an oversized tail
                tail_text = ""
            buf = [tail_text] if tail_text else []
            buf_pages = [buf_pages[-1]] if tail_text and buf_pages else []
        else:
            buf, buf_pages = [], []

    for blk in blocks:
        if blk.is_heading:
            flush(carry=False)
            section = re.sub(r"^(chapter\s+)?[\d.]+\s*|\s+\d{1,4}$", "", blk.text, flags=re.I).strip(" |)") or blk.text
            skip_section = bool(BACK_MATTER_RE.match(section))
            if FRONT_MATTER_RE.match(section):
                skip_until_page = blk.page + FRONT_MATTER_MAX_PAGES
            continue
        words = blk.text.split()
        # Split pathological blocks (some PDFs emit a whole page as one block)
        pieces = [blk.text] if len(words) <= max_words else _split_long(blk.text, target_words)
        for piece in pieces:
            current = sum(len(b.split()) for b in buf)
            if current and current + len(piece.split()) > max_words:
                flush(carry=True)
            buf.append(piece)
            buf_pages.append(blk.page)
            if sum(len(b.split()) for b in buf) >= target_words:
                flush(carry=True)
    flush(carry=False)
    return chunks


def _split_long(text: str, target: int) -> list[str]:
    out, cur = [], []
    for s in _sentences(text):
        cur.append(s)
        if sum(len(x.split()) for x in cur) >= target:
            out.append(" ".join(cur))
            cur = []
    if cur:
        out.append(" ".join(cur))
    return out
