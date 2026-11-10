"""Stage 5 - Question generation from retrieved context.

LLM path: the prompt carries the topic plan, the candidate digest, the adaptive state
and the retrieved chunks (with ids). The model must return the chunk ids it used;
ids not in the retrieved set are discarded, and if none survive the question is
rejected as ungrounded and regenerated once at a lower temperature.

Offline path: an extractive generator that builds the question around the concept
and definitional sentences of the top retrieved chunk - still grounded and
traceable, just less fluent. Every question records which generator produced it.
"""
from __future__ import annotations

import logging
import re

from app.core.errors import LLMError
from app.llm.client import get_llm
from app.prompts import templates as T
from app.rag.retriever import RetrievedChunk
from app.schemas.pipeline import GeneratedQuestion, PlannedTopic, ResumeProfile

log = logging.getLogger(__name__)


def candidate_digest(p: ResumeProfile) -> dict:
    return {
        "headline": p.headline or p.summary[:120],
        "seniority": p.seniority,
        "years_experience": p.years_experience,
        "top_skills": [s.name for s in p.skills][:15],
        "projects": [{"title": pr.title, "tech": pr.technologies[:5]} for pr in p.projects[:3]],
        "domains": p.domains[:3],
    }


def _chunk_dicts(chunks: list[RetrievedChunk]) -> list[dict]:
    return [
        {"id": c.id, "book_title": c.book_title, "page_start": c.page_start, "section": c.section, "text": c.text}
        for c in chunks
    ]


def generate_question(
    *,
    role_title: str,
    profile: ResumeProfile,
    topic: PlannedTopic,
    difficulty: int,
    chunks: list[RetrievedChunk],
    previous_questions: list[str],
    adaptive_note: str,
    follow_up: dict | None = None,
) -> tuple[GeneratedQuestion, str]:
    """Returns (question, generator_name)."""
    llm = get_llm()
    if llm and chunks:
        valid_ids = {c.id for c in chunks}
        for temperature in (0.7, 0.35):
            try:
                raw = llm.generate_json(
                    T.QUESTION_SYSTEM,
                    T.question_prompt(
                        role_title=role_title,
                        candidate=candidate_digest(profile),
                        topic=topic.model_dump(),
                        difficulty=difficulty,
                        chunks=_chunk_dicts(chunks),
                        previous_questions=previous_questions,
                        adaptive_note=adaptive_note,
                        follow_up=follow_up,
                    ),
                    temperature=temperature,
                )
                raw["difficulty"] = difficulty  # the engine's level is authoritative (keeps Easy/Medium/Hard honest)
                raw["expected_points"] = [
                    p if isinstance(p, str) else " ".join(str(v) for v in p.values()) if isinstance(p, dict) else str(p)
                    for p in (raw.get("expected_points") or [])
                ]
                raw["grounding_chunk_ids"] = [str(i).strip("[] ") for i in (raw.get("grounding_chunk_ids") or [])]
                if raw.get("question_type") not in ("conceptual", "applied", "scenario", "comparison", "debugging", "design"):
                    raw["question_type"] = topic.question_style
                q = GeneratedQuestion.model_validate(raw)
                q.grounding_chunk_ids = [i for i in q.grounding_chunk_ids if i in valid_ids]
                if not q.grounding_chunk_ids:
                    log.info("Rejecting ungrounded question (no valid chunk citations); retrying")
                    continue
                q.expected_points = [p for p in q.expected_points if p.strip()][:5]
                return q, llm.name
            except ValueError as e:  # malformed output: retry once at lower temperature
                log.warning("LLM question failed validation, retrying: %s", str(e)[:200])
                continue
            except LLMError as e:  # provider unavailable: fall back immediately
                log.warning("LLM question generation failed: %s", e)
                break
    return offline_question(profile, topic, difficulty, chunks, follow_up), "offline-extractive"


# --------------------------------------------------------------------------- offline
# Deterministic fallback. It cannot paraphrase like an LLM, so it builds the question
# around the most specific concept the retrieved passage is about (its section title or
# a definitional sentence) and a style/difficulty-appropriate framing.
_DEF_RE = re.compile(r"\b([A-Za-z][\w\- ]{2,40}?)\s+(?:is|are|refers to|can be defined as)\s+(?:a|an|the|one)\s+[^.]{15,160}\.")
_PRONOUN = re.compile(r"^(this|that|these|those|it|they|there|here|we|one|each|such|which|our|its|their|the result|the following)\b", re.I)
_JUNK_LABEL = re.compile(r"exercise|summary|introduction|figure|chapter|contents|appendix|example|table|notes?$|^\W", re.I)

_FRAMES: dict[str, dict[int, str]] = {
    "conceptual": {
        1: "In your own words, what is {c}, and where would you encounter it?",
        2: "Explain how {c} works and why it is needed.",
        3: "Explain {c} and walk me through a concrete example of it in action.",
        4: "What assumptions does {c} rely on, and what happens when they are violated?",
        5: "Critically evaluate {c}: when do its assumptions break, and what would you use instead?",
    },
    "scenario": {
        1: "Imagine a {d} team asks you what {c} is. How would you explain it to them?",
        2: "In a {d} system, how would {c} come into play, and why would it matter?",
        3: "Imagine a {d} system where {c} is central. How would you apply it, and what would you monitor?",
        4: "In a {d} system that depends on {c}, what could go wrong at scale, and how would you mitigate it?",
        5: "Design how you would use {c} in a {d} system, justifying each choice against the alternatives.",
    },
    "debugging": {
        1: "A teammate says their model 'ignores' {c}. What would you check first?",
        2: "A model relying on {c} behaves unexpectedly. Explain how {c} works and where you would look for the bug.",
        3: "A model relying on {c} does well in training but poorly on new data. What are the likely causes?",
        4: "A model relying on {c} performs well in training but poorly in production. Diagnose the likely causes and fixes.",
        5: "A model built on {c} degrades silently after deployment. Reason through the failure modes and how you would prove which one it is.",
    },
}


def _good_label(text: str) -> bool:
    t = text.strip()
    if not 3 <= len(t) <= 70 or len(t.split()) > 8:
        return False
    if re.search(r"[(),=\[\]{}|<>;]|\d{2,}", t) or _JUNK_LABEL.search(t) or _PRONOUN.match(t):
        return False
    if re.match(r"(and|or|but|of|to|in|on|with|for|from|by|as|at|instead|then|so|if|when|a|an|the)\b", t, re.I):
        return False  # sentence fragments, not titles
    if not any(len(w) >= 4 for w in re.findall(r"[A-Za-z]+", t)):
        return False
    letters = sum(c.isalpha() for c in t)
    return letters / max(1, len(t.replace(" ", ""))) >= 0.8


def _label(text: str) -> str:
    t = text.strip(" .:-")
    return t.lower() if t.isupper() or (t[:1].isupper() and not t.split()[0].isupper() and len(t.split()) > 1) else t


def _concept(topic: PlannedTopic, chunk: RetrievedChunk) -> str:
    if _good_label(chunk.section):
        return _label(chunk.section)
    for m in _DEF_RE.finditer(chunk.text):
        cand = m.group(1).strip()
        if len(cand.split()) <= 5 and _good_label(cand):
            return _label(cand)
    return topic.title.lower()


def _key_sentences(text: str, n: int = 4) -> list[str]:
    sents = [
        s.strip()
        for s in re.split(r"(?<=[.!?])\s+", text)
        if 8 <= len(s.split()) <= 40 and not re.search(r"[=<>{}\[\]]|Figure|Table|Eq\.", s) and not _PRONOUN.match(s)
    ]
    scored = sorted(
        sents,
        key=lambda s: (bool(re.search(r"\b(is|are|because|therefore|means|allows|requires|so that|ensures|called)\b", s)), -abs(len(s.split()) - 22)),
        reverse=True,
    )
    return scored[:n]


def _distinct(a: str, b: str) -> bool:
    wa = {w for w in re.findall(r"[a-z]{4,}", a.lower())}
    wb = {w for w in re.findall(r"[a-z]{4,}", b.lower())}
    return bool(wa and wb) and len(wa & wb) / min(len(wa), len(wb)) < 0.5


def _shorten(text: str, words: int = 18) -> str:
    w = text.split()
    return " ".join(w[:words]).rstrip(",;:") + ("…" if len(w) > words else "")


def offline_question(
    profile: ResumeProfile, topic: PlannedTopic, difficulty: int, chunks: list[RetrievedChunk], follow_up: dict | None
) -> GeneratedQuestion:
    if not chunks:
        raise LLMError("No grounded context retrieved for this topic")
    main = chunks[0]
    concept = _concept(topic, main)
    other = next((c for c in chunks[1:] if _good_label(c.section) and _label(c.section) != concept), None)
    skills = [s.name for s in profile.skills if s.category in ("ml_framework", "ml_concept")]
    project = profile.projects[0] if profile.projects else None
    domain = profile.domains[0].lower() if profile.domains else "production"
    style = topic.question_style
    d = max(1, min(5, difficulty))
    cited = [main.id]

    if follow_up:
        gap = _shorten((follow_up.get("missed_points") or [main.text])[0])
        text = (
            f"Let's stay on {concept} for a moment. Your previous answer didn't touch on this idea: \"{gap}\" "
            f"Can you explain what it means and why it matters?"
        )
        style = "conceptual"
    elif style == "comparison" and other and _distinct(concept, _label(other.section)):
        o = _label(other.section)
        text = f"Compare {concept} with {o}. What problem does each solve, and when would you prefer one over the other?"
        cited.append(other.id)
    elif style in ("applied", "design") and (project or skills):
        ctx = f"your project \"{project.title}\"" if project else f"your work with {skills[0]}"
        if style == "design":
            text = f"Suppose you were rebuilding {ctx} today. How would {concept} shape your design, and which trade-offs would you make?"
        else:
            text = f"Thinking about {ctx}: where does {concept} show up, and what decisions would it drive? How would you verify it was working?"
    else:
        frames = _FRAMES.get(style, _FRAMES["conceptual"])
        text = frames[d].format(c=concept, d=domain)

    text = text[0].upper() + text[1:]
    return GeneratedQuestion(
        question=text,
        question_type=style,  # type: ignore[arg-type]
        difficulty=d,
        expected_points=_key_sentences(main.text) or [_shorten(main.text, 40)],
        grounding_chunk_ids=cited,
        resume_link=topic.resume_anchor,
        rationale=f"Extractive question grounded in '{main.section or main.book_title}' (p.{main.page_start}).",
    )
