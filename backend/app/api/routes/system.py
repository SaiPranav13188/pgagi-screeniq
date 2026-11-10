"""Health, role catalogue and knowledge-base endpoints."""
from __future__ import annotations

import threading
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.core.errors import ConflictError, ValidationFailed
from app.db.database import engine
from app.llm.client import llm_status
from app.rag.catalog import BOOKS, ROLES, get_role
from app.rag.ingest import ingest_all, load_manifest
from app.rag.retriever import get_retriever
from app.schemas.api import SearchIn

router = APIRouter(tags=["system"])
_ingest_state: dict = {"running": False, "log": [], "started_at": None, "finished_at": None, "error": None}
_ingest_lock = threading.Lock()


@router.get("/health")
def health():
    db_ok = True
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    m = load_manifest()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": db_ok,
        "knowledge_base": {"chunks": m.get("total_chunks", 0), "books": len(m.get("books", {}))},
        "llm": llm_status(),
        "time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/roles")
def roles():
    m = load_manifest().get("books", {})

    def book(bid: str, tier: str) -> dict:
        b = BOOKS[bid]
        return {"id": b.id, "title": b.title, "author": b.author, "level": b.level, "color": b.color, "tier": tier,
                "ingested": bid in m, "chunks": m.get(bid, {}).get("chunks", 0)}

    return [
        {
            "id": r.id, "title": r.title, "tagline": r.tagline, "description": r.description,
            "books": [book(b, "primary") for b in r.primary_books] + [book(b, "advanced") for b in r.advanced_books],
            "competencies": [{"id": c.id, "name": c.name} for c in r.competencies],
        }
        for r in ROLES.values()
    ]


@router.get("/knowledge-base")
def knowledge_base():
    s = get_settings()
    m = load_manifest()
    return {
        "embedding_model": m.get("embedding_model", s.embedding_model),
        "total_chunks": m.get("total_chunks", 0),
        "chunking": {"target_words": s.chunk_target_words, "max_words": s.chunk_max_words, "overlap_sentences": s.chunk_overlap_sentences},
        "retrieval": {"candidates": s.retrieval_candidates, "top_k": s.retrieval_top_k, "rrf_k": s.rrf_k,
                      "mmr_lambda": s.mmr_lambda, "min_dense_score": s.min_dense_score},
        "books": [
            {"id": b.id, "title": b.title, "author": b.author, "level": b.level, "color": b.color,
             "available": (s.books_dir / b.filename).exists(), **m.get("books", {}).get(b.id, {})}
            for b in BOOKS.values()
        ],
        "ingestion": {k: v for k, v in _ingest_state.items() if k != "log"} | {"log": _ingest_state["log"][-20:]},
    }


@router.post("/knowledge-base/search", summary="RAG playground: run hybrid retrieval for any query")
def search(body: SearchIn):
    if body.book_ids:
        books = [b for b in body.book_ids if b in BOOKS]
    elif body.role_id:
        role = get_role(body.role_id)
        if not role:
            raise ValidationFailed(f"Unknown role '{body.role_id}'")
        books = list(role.primary_books + role.advanced_books)
    else:
        books = list(BOOKS)
    if not books:
        raise ValidationFailed("No valid books selected")
    res = get_retriever().retrieve([body.query], books, top_k=body.top_k)
    return {"query": body.query, "books": books, "elapsed_ms": res.elapsed_ms,
            "candidates_considered": res.candidates_considered, "chunks": [c.to_trace() for c in res.chunks]}


@router.post("/knowledge-base/ingest", status_code=202, summary="(Re)build the knowledge base in the background")
def ingest(force: bool = False):
    with _ingest_lock:
        if _ingest_state["running"]:
            raise ConflictError("Ingestion already running")
        _ingest_state.update(running=True, log=[], error=None, started_at=datetime.now(timezone.utc).isoformat(), finished_at=None)

    def run() -> None:
        try:
            ingest_all(force=force, progress=lambda stage, d: _ingest_state["log"].append({"stage": stage, **d}))
        except Exception as e:  # surfaced via GET /knowledge-base
            _ingest_state["error"] = str(e)
        finally:
            _ingest_state.update(running=False, finished_at=datetime.now(timezone.utc).isoformat())

    threading.Thread(target=run, daemon=True).start()
    return {"status": "started", "force": force}
