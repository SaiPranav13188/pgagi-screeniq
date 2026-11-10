"""Stage 7 - Answer evaluation.

LLM grading against the question's expected points *and* the retrieved textbook
passages (so grading is grounded in the same source the question came from).
Offline grading uses semantic coverage: each expected point counts as covered if some
sentence of the answer is close to it in embedding space.
"""
from __future__ import annotations

import logging
import re

import numpy as np

from app.core.errors import LLMError
from app.llm.client import get_llm
from app.prompts import templates as T
from app.rag.embeddings import Embedder
from app.schemas.pipeline import Evaluation, verdict_for

log = logging.getLogger(__name__)
NON_ANSWER_RE = re.compile(r"^\s*(i\s*(do\s*not|don'?t)\s*know|idk|no\s*idea|not\s*sure|skip|pass|n/?a|-+|\.+)\s*[.!]*\s*$", re.I)


def _non_answer(answer: str) -> Evaluation | None:
    if not answer.strip() or NON_ANSWER_RE.match(answer) or len(answer.split()) < 4:
        return Evaluation(
            score=0.0,
            verdict="no_answer",
            improvements=["Even a partial answer helps - describe what you do know about the concept."],
            feedback="No substantive answer was given for this question.",
            evaluator="rule",
        )
    return None


def evaluate_answer(question: str, difficulty: int, expected: list[str], chunks: list[dict], answer: str) -> Evaluation:
    if (trivial := _non_answer(answer)) is not None:
        return trivial
    llm = get_llm()
    if llm:
        try:
            raw = llm.generate_json(T.EVAL_SYSTEM, T.eval_prompt(question, difficulty, expected, chunks, answer), temperature=0.1)
            score = float(max(0.0, min(10.0, float(raw.get("score", 0)))))
            for k in ("covered_points", "missed_points", "strengths", "improvements", "misconceptions"):
                raw[k] = [i if isinstance(i, str) else str(i) for i in (raw.get(k) or [])]
            raw["feedback"] = str(raw.get("feedback") or "")
            verdict = verdict_for(score)
            if verdict == "no_answer":  # the candidate did write something: it is a weak answer, not a non-answer
                verdict = "weak"
            return Evaluation.model_validate(
                {**raw, "score": round(score, 1), "verdict": verdict, "evaluator": llm.name}
            )
        except (LLMError, ValueError, TypeError) as e:
            log.warning("LLM evaluation failed, using semantic grader: %s", e)
    return semantic_evaluation(expected, chunks, answer)


def semantic_evaluation(expected: list[str], chunks: list[dict], answer: str) -> Evaluation:
    emb = Embedder.get()
    sents = [s for s in re.split(r"(?<=[.!?;])\s+|\n+", answer) if len(s.split()) >= 3] or [answer]
    a_vecs = emb.embed_passages(sents)
    covered, missed = [], []
    if expected:
        p_vecs = emb.embed_passages(expected)
        sims = p_vecs @ a_vecs.T  # points x sentences
        for point, best in zip(expected, sims.max(axis=1)):
            (covered if best >= 0.74 else missed).append(point)
        coverage = len(covered) / len(expected)
    else:
        coverage = 0.5
    ctx = " ".join(c["text"][:600] for c in chunks[:3])
    rel = float(np.max(emb.embed_passages([ctx]) @ a_vecs.T)) if ctx else 0.6
    relevance = min(1.0, max(0.0, (rel - 0.55) / 0.3))
    length = min(1.0, len(answer.split()) / 90)
    score = round(10 * (0.55 * coverage + 0.3 * relevance + 0.15 * length), 1)
    strengths = [f"Addressed: {p[:110]}" for p in covered[:2]]
    if relevance > 0.6:
        strengths.append("Answer stays on-topic and uses relevant terminology.")
    return Evaluation(
        score=score,
        verdict="weak" if verdict_for(score) == "no_answer" else verdict_for(score),
        covered_points=covered,
        missed_points=missed,
        strengths=strengths,
        improvements=[f"Cover: {p[:110]}" for p in missed[:3]],
        feedback=(
            f"Your answer covered {len(covered)} of {len(expected)} key ideas from the reference material."
            + (" Expand on the missing points with concrete reasoning." if missed else " Well covered.")
        ),
        evaluator="offline-semantic",
    )
