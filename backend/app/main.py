"""FastAPI application factory."""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import sessions, system
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.db.database import init_db

settings = get_settings()
configure_logging(settings.log_level)
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    log.info("Database ready; LLM provider: %s", "gemini" if settings.llm_enabled else "offline (no GEMINI_API_KEY)")
    # Warm the RAG stack in the background so the first interview is not slow.
    import threading

    def warm() -> None:
        try:
            from app.rag.retriever import get_retriever

            get_retriever()
            log.info("Retriever warmed (embeddings + vector store + BM25)")
        except Exception as e:  # e.g. KB not built yet
            log.warning("Retriever warm-up skipped: %s", e)

    threading.Thread(target=warm, daemon=True).start()
    yield
    from app.rag.vector_store import VectorStore

    VectorStore.close()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="RAG-powered, role-based technical interview engine.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request.state.request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        t0 = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - t0) * 1000
        response.headers["x-request-id"] = request.state.request_id
        response.headers["server-timing"] = f"app;dur={ms:.0f}"
        if request.url.path.startswith("/api"):
            log.info("%s %s -> %s (%.0f ms)", request.method, request.url.path, response.status_code, ms)
        return response

    register_error_handlers(app)
    app.include_router(system.router, prefix="/api/v1")
    app.include_router(sessions.router, prefix="/api/v1")

    @app.get("/", include_in_schema=False)
    def root():
        return {"name": settings.app_name, "docs": "/docs", "health": "/api/v1/health"}

    return app


app = create_app()
