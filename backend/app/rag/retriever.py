"""Hybrid, multi-query retrieval with diversity re-ranking.

    queries ──► dense search (Qdrant, cosine)  ─┐
            └─► lexical search (BM25)          ─┴─► Reciprocal Rank Fusion
                                                     │
                                  grounding floor (min dense similarity)
                                                     │
                            Maximal Marginal Relevance (relevance vs. redundancy)
                                                     │
                                                 top-k chunks

* Multi-query: the planner emits 2-3 phrasings per topic; fusing them makes retrieval
  robust to any single query being phrased differently from the book.
* RRF is rank-based, so BM25 scores and cosine similarities never need calibrating.
* The grounding floor rejects chunks whose *semantic* similarity is weak even if they
  matched lexically, so the generator is never fed off-topic text.
* MMR avoids handing the LLM four near-duplicate paragraphs from the same page.
"""
from __future__ import annotations

import logging
import time
from collections.abc import Sequence
from dataclasses import dataclass, field

import numpy as np

from app.core.config import get_settings
from app.rag.catalog import BOOKS
from app.rag.embeddings import Embedder
from app.rag.lexical import LexicalIndex
from app.rag.vector_store import VectorStore

log = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    id: str
    book_id: str
    book_title: str
    section: str
    page_start: int
    page_end: int
    text: str
    dense_score: float = 0.0
    bm25_rank: int | None = None
    dense_rank: int | None = None
    rrf_score: float = 0.0
    matched_queries: list[str] = field(default_factory=list)

    def to_trace(self, cited: bool = False, snippet_chars: int = 1200) -> dict:
        return {
            "id": self.id,
            "book_id": self.book_id,
            "book_title": self.book_title,
            "section": self.section,
            "page_start": self.page_start,
            "page_end": self.page_end,
            "text": self.text[:snippet_chars],
            "dense_score": round(self.dense_score, 4),
            "dense_rank": self.dense_rank,
            "bm25_rank": self.bm25_rank,
            "rrf_score": round(self.rrf_score, 5),
            "matched_queries": self.matched_queries,
            "cited": cited,
        }


@dataclass
class RetrievalResult:
    queries: list[str]
    books: list[str]
    chunks: list[RetrievedChunk]
    elapsed_ms: int
    candidates_considered: int


class Retriever:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.embedder = Embedder.get()
        self.store = VectorStore.get()
        self.lexical = LexicalIndex.get()

    def retrieve(
        self,
        queries: Sequence[str],
        book_ids: Sequence[str],
        top_k: int | None = None,
        exclude_ids: Sequence[str] = (),
    ) -> RetrievalResult:
        s = self.settings
        t0 = time.perf_counter()
        top_k = top_k or s.retrieval_top_k
        queries = [q.strip() for q in queries if q and q.strip()][:5]
        excluded = set(exclude_ids)
        pool: dict[str, RetrievedChunk] = {}

        def _get(payload: dict) -> RetrievedChunk:
            cid = payload["id"]
            if cid not in pool:
                pool[cid] = RetrievedChunk(
                    id=cid,
                    book_id=payload["book_id"],
                    book_title=BOOKS[payload["book_id"]].title if payload["book_id"] in BOOKS else payload["book_id"],
                    section=payload.get("section", ""),
                    page_start=payload["page_start"],
                    page_end=payload["page_end"],
                    text=payload["text"],
                )
            return pool[cid]

        q_vecs = self.embedder.embed_queries(queries) if queries else np.zeros((0, 384))
        for q, qv in zip(queries, q_vecs):
            for rank, (payload, score) in enumerate(self.store.search(qv, book_ids, s.retrieval_candidates)):
                if payload["id"] in excluded:
                    continue
                ch = _get(payload)
                ch.rrf_score += 1.0 / (s.rrf_k + rank + 1)
                ch.dense_score = max(ch.dense_score, score)
                ch.dense_rank = rank + 1 if ch.dense_rank is None else min(ch.dense_rank, rank + 1)
                if q not in ch.matched_queries:
                    ch.matched_queries.append(q)
            for rank, (payload, _) in enumerate(self.lexical.search(q, book_ids, s.retrieval_candidates)):
                if payload["id"] in excluded:
                    continue
                ch = _get(payload)
                ch.rrf_score += 1.0 / (s.rrf_k + rank + 1)
                ch.bm25_rank = rank + 1 if ch.bm25_rank is None else min(ch.bm25_rank, rank + 1)
                if q not in ch.matched_queries:
                    ch.matched_queries.append(q)

        candidates = sorted(pool.values(), key=lambda c: c.rrf_score, reverse=True)[: s.retrieval_candidates]
        # Lexical-only hits have no dense score yet: compute it so the grounding floor applies to all.
        vecs = self.store.vectors_for([c.id for c in candidates])
        mean_q = q_vecs.mean(axis=0) if len(q_vecs) else None
        if mean_q is not None:
            mean_q = mean_q / max(np.linalg.norm(mean_q), 1e-12)
            for c in candidates:
                if c.id in vecs:
                    sims = q_vecs @ vecs[c.id]
                    c.dense_score = max(c.dense_score, float(sims.max()))

        grounded = [c for c in candidates if c.dense_score >= s.min_dense_score and c.id in vecs]
        if len(grounded) < top_k:  # never return nothing: fall back to the best available
            grounded = [c for c in candidates if c.id in vecs][: max(top_k, len(grounded))]

        selected = self._mmr(grounded, vecs, mean_q, top_k, s.mmr_lambda)
        elapsed = int((time.perf_counter() - t0) * 1000)
        return RetrievalResult(list(queries), list(book_ids), selected, elapsed, len(pool))

    @staticmethod
    def _mmr(cands: list[RetrievedChunk], vecs: dict, q: np.ndarray | None, k: int, lam: float) -> list[RetrievedChunk]:
        if not cands or q is None:
            return cands[:k]
        # Relevance = normalised RRF (blends lexical + dense evidence across all queries).
        max_rrf = max(c.rrf_score for c in cands) or 1.0
        rel = {c.id: 0.5 * (c.rrf_score / max_rrf) + 0.5 * c.dense_score for c in cands}
        chosen: list[RetrievedChunk] = []
        remaining = list(cands)
        while remaining and len(chosen) < k:
            def score(c: RetrievedChunk) -> float:
                if not chosen:
                    return rel[c.id]
                redundancy = max(float(vecs[c.id] @ vecs[s.id]) for s in chosen)
                return lam * rel[c.id] - (1 - lam) * redundancy

            best = max(remaining, key=score)
            chosen.append(best)
            remaining.remove(best)
        return chosen


_retriever: Retriever | None = None


def get_retriever() -> Retriever:
    global _retriever
    if _retriever is None or _retriever.lexical is not LexicalIndex.get():
        _retriever = Retriever()
    return _retriever
