"""Local embedding model (fastembed / ONNX, CPU-friendly, no API key required).

BAAI/bge-small-en-v1.5: 384-d, strong MTEB retrieval scores for its size and fast on
CPU, which matters because we embed ~2,000 book pages at ingestion time.
BGE models expect an instruction prefix on *queries* only (asymmetric retrieval).
"""
from __future__ import annotations

import logging
import threading
from collections.abc import Sequence

import numpy as np

from app.core.config import get_settings

log = logging.getLogger(__name__)


class Embedder:
    _instance: "Embedder | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        from fastembed import TextEmbedding

        s = get_settings()
        log.info("Loading embedding model %s", s.embedding_model)
        self.model = TextEmbedding(model_name=s.embedding_model, cache_dir=str(s.index_dir.parent / "models"))
        self.query_prefix = s.embedding_query_prefix
        self.batch_size = s.embedding_batch_size
        self.dim = len(self.embed_passages(["probe"])[0])

    @classmethod
    def get(cls) -> "Embedder":
        with cls._lock:
            if cls._instance is None:
                cls._instance = Embedder()
            return cls._instance

    def embed_passages(self, texts: Sequence[str]) -> np.ndarray:
        vecs = np.array(list(self.model.embed(list(texts), batch_size=self.batch_size)), dtype=np.float32)
        return _normalize(vecs)

    def embed_queries(self, texts: Sequence[str]) -> np.ndarray:
        return self.embed_passages([self.query_prefix + t for t in texts])


def _normalize(v: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(v, axis=1, keepdims=True)
    return v / np.clip(norms, 1e-12, None)
