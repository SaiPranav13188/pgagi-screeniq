"""Knowledge-base ingestion: books -> chunks -> embeddings -> Qdrant (+ JSONL for BM25).

Idempotent: a manifest records a fingerprint of each PDF and of the chunking config,
so re-running only processes books that changed.
"""
from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings
from app.rag.catalog import BOOKS
from app.rag.chunking import chunk_book
from app.rag.embeddings import Embedder
from app.rag.lexical import LexicalIndex, write_chunks
from app.rag.vector_store import VectorStore

log = logging.getLogger(__name__)
Progress = Callable[[str, dict], None]


def manifest_path() -> Path:
    return get_settings().index_dir / "manifest.json"


def load_manifest() -> dict:
    p = manifest_path()
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"books": {}}


def _save_manifest(m: dict) -> None:
    manifest_path().write_text(json.dumps(m, indent=2), encoding="utf-8")


def _fingerprint(path: Path) -> str:
    s = get_settings()
    st = path.stat()
    return f"{st.st_size}:{int(st.st_mtime)}:{s.embedding_model}:{s.chunk_target_words}:{s.chunk_max_words}:{s.chunk_overlap_sentences}"


def ingest_all(force: bool = False, progress: Progress | None = None) -> dict:
    s = get_settings()
    progress = progress or (lambda stage, data: log.info("%s %s", stage, data))
    manifest = load_manifest()
    embedder = Embedder.get()
    store = VectorStore.get()
    store.ensure_collection(embedder.dim, recreate=force)
    if force:
        manifest = {"books": {}}

    for book in BOOKS.values():
        path = s.books_dir / book.filename
        if not path.exists():
            progress("missing", {"book_id": book.id, "file": book.filename})
            manifest["books"].pop(book.id, None)
            continue
        fp = _fingerprint(path)
        if manifest["books"].get(book.id, {}).get("fingerprint") == fp:
            progress("skipped", {"book_id": book.id, "reason": "unchanged"})
            continue

        t0 = time.perf_counter()
        progress("chunking", {"book_id": book.id})
        chunks = chunk_book(str(path), book.id, s.chunk_target_words, s.chunk_max_words, s.chunk_overlap_sentences)
        payloads = [c.to_dict() for c in chunks]
        progress("embedding", {"book_id": book.id, "chunks": len(payloads)})
        vectors = embedder.embed_passages([f"{p['section']}. {p['text']}" for p in payloads])
        store.delete_book(book.id)
        store.upsert(payloads, vectors)
        write_chunks(book.id, payloads)
        import fitz

        with fitz.open(str(path)) as d:
            pages = d.page_count
        manifest["books"][book.id] = {
            "fingerprint": fp,
            "chunks": len(payloads),
            "pages": pages,
            "avg_words": round(sum(p["word_count"] for p in payloads) / max(1, len(payloads))),
            "sections": len({p["section"] for p in payloads}),
            "seconds": round(time.perf_counter() - t0, 1),
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        }
        _save_manifest(manifest)
        progress("done", {"book_id": book.id, **manifest["books"][book.id]})

    manifest["embedding_model"] = s.embedding_model
    manifest["total_chunks"] = sum(b["chunks"] for b in manifest["books"].values())
    _save_manifest(manifest)
    LexicalIndex.reset()
    return manifest
