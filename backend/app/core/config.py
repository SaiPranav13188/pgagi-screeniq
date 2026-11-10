"""Centralised, environment-driven configuration.

Every tunable of the system (storage locations, model names, RAG hyper-parameters,
interview defaults) is read from environment variables / `.env` so the same code runs
locally, in Docker or in CI without edits.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(PROJECT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Application -------------------------------------------------------------
    app_name: str = "PGAGI Interview Intelligence"
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Optional regex for dynamic origins, e.g. Vercel preview URLs: https://.*\.vercel\.app
    cors_origin_regex: str | None = None

    # --- Storage -----------------------------------------------------------------
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'app.db').as_posix()}"
    books_dir: Path = PROJECT_DIR / "data" / "books"
    index_dir: Path = BACKEND_DIR / "data" / "index"
    # Embedded (on-disk) Qdrant by default; set QDRANT_URL to use a Qdrant server.
    qdrant_path: Path = BACKEND_DIR / "data" / "qdrant"
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None
    qdrant_collection: str = "knowledge_chunks"

    # --- Embeddings / chunking ---------------------------------------------------
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_query_prefix: str = "Represent this sentence for searching relevant passages: "
    chunk_target_words: int = 230
    chunk_max_words: int = 320
    chunk_overlap_sentences: int = 2
    embedding_batch_size: int = 64

    # --- Retrieval -----------------------------------------------------------------
    retrieval_candidates: int = 30  # per retriever, before fusion
    retrieval_top_k: int = 4  # chunks handed to the generator
    rrf_k: int = 60
    mmr_lambda: float = 0.72
    min_dense_score: float = 0.52  # grounding floor (cosine)

    # --- LLM -----------------------------------------------------------------------
    llm_provider: str = "gemini"  # "gemini" | "offline"
    gemini_api_key: str | None = None
    # Tried in order; on 404 / quota errors the next model is used.
    gemini_models: str = "gemini-3.8-flash,gemini-3-flash-preview,gemini-3.5-flash-lite"
    gemini_thinking_level: str | None = "low"
    llm_temperature: float = 0.6
    llm_timeout_seconds: float = 40.0
    llm_max_retries: int = 2

    # --- Interview ---------------------------------------------------------------
    default_question_count: int = 6
    min_question_count: int = 3
    max_question_count: int = 10
    max_follow_ups: int = 2
    follow_up_threshold: float = 4.5  # score (0-10) below which we probe deeper
    escalate_threshold: float = 8.0  # score at/above which difficulty steps up
    max_upload_mb: int = 5
    max_answer_chars: int = 6000

    @field_validator("gemini_api_key", "qdrant_url", "qdrant_api_key", "cors_origin_regex", mode="before")
    @classmethod
    def _blank_is_none(cls, v):
        return v or None

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalise_db_url(cls, v):
        # Hosted Postgres (Render, Supabase, Heroku) hands out postgres:// URLs; use the psycopg 3 driver.
        if isinstance(v, str):
            for prefix in ("postgres://", "postgresql://"):
                if v.startswith(prefix):
                    return "postgresql+psycopg://" + v[len(prefix):]
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def gemini_model_list(self) -> list[str]:
        return [m.strip() for m in self.gemini_models.split(",") if m.strip()]

    @property
    def llm_enabled(self) -> bool:
        return self.llm_provider.lower() == "gemini" and bool(self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    for p in (s.index_dir, s.qdrant_path, BACKEND_DIR / "data"):
        Path(p).mkdir(parents=True, exist_ok=True)
    return s
