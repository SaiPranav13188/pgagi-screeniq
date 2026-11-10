"""Chunk store (JSONL on disk) + in-memory BM25 lexical index.

Dense embeddings capture meaning but blur exact technical terms ("ID3", "VC dimension",
"Laplace smoothing"). BM25 nails those. Hybrid retrieval fuses both (see retriever.py).
"""
from __future__ import annotations

import json
import re
import threading
from collections.abc import Sequence
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi

from app.core.config import get_settings

STOPWORDS = set(
    """a an the and or of to in on for with by from as is are was were be been being this that these those it its
    at into than then there their they them which who whom what when where why how can could should would may might
    will shall do does did not no yes we you your our i me my he she his her also such each other more most some any
    all both only own same so too very just about over under again further once here between through during before after
    above below up down out off use used using one two three like explain describe""".split()
)
TOKEN_RE = re.compile(r"[a-z][a-z0-9\-]+")


def tokenize(text: str) -> list[str]:
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS and len(t) > 1]


def chunks_dir() -> Path:
    d = get_settings().index_dir / "chunks"
    d.mkdir(parents=True, exist_ok=True)
    return d


def write_chunks(book_id: str, chunks: Sequence[dict]) -> None:
    with open(chunks_dir() / f"{book_id}.jsonl", "w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")


def read_all_chunks() -> list[dict]:
    out: list[dict] = []
    for p in sorted(chunks_dir().glob("*.jsonl")):
        with open(p, encoding="utf-8") as f:
            out.extend(json.loads(line) for line in f if line.strip())
    return out


class LexicalIndex:
    _instance: "LexicalIndex | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self.chunks = read_all_chunks()
        self.by_id = {c["id"]: c for c in self.chunks}
        self.book_ids = np.array([c["book_id"] for c in self.chunks])
        corpus = [tokenize(f"{c['section']} {c['text']}") for c in self.chunks]
        self.bm25 = BM25Okapi(corpus) if corpus else None

    @classmethod
    def get(cls) -> "LexicalIndex":
        with cls._lock:
            if cls._instance is None:
                cls._instance = LexicalIndex()
            return cls._instance

    @classmethod
    def reset(cls) -> None:
        with cls._lock:
            cls._instance = None

    def search(self, query: str, book_ids: Sequence[str], limit: int) -> list[tuple[dict, float]]:
        if not self.bm25:
            return []
        tokens = tokenize(query)
        if not tokens:
            return []
        scores = self.bm25.get_scores(tokens)
        mask = np.isin(self.book_ids, list(book_ids))
        scores = np.where(mask, scores, -1.0)
        top = np.argsort(-scores)[:limit]
        return [(self.chunks[i], float(scores[i])) for i in top if scores[i] > 0]
