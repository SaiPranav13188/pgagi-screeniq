"""Vector database access (Qdrant).

Embedded/on-disk Qdrant by default so the project runs with zero infrastructure;
setting QDRANT_URL switches to a Qdrant server with no code changes. All chunks live
in one collection and roles select their books through a payload filter on `book_id`
(indexed), which keeps ingestion independent of the role catalogue.
"""
from __future__ import annotations

import logging
import threading
import uuid
from collections.abc import Sequence

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from app.core.config import get_settings

log = logging.getLogger(__name__)


def point_id(chunk_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))


class VectorStore:
    _instance: "VectorStore | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        s = get_settings()
        self.collection = s.qdrant_collection
        if s.qdrant_url:
            self.client = QdrantClient(url=s.qdrant_url, api_key=s.qdrant_api_key)
        else:
            self.client = QdrantClient(path=str(s.qdrant_path))

    @classmethod
    def get(cls) -> "VectorStore":
        with cls._lock:
            if cls._instance is None:
                cls._instance = VectorStore()
            return cls._instance

    @classmethod
    def close(cls) -> None:
        with cls._lock:
            if cls._instance is not None:
                cls._instance.client.close()
                cls._instance = None

    def ensure_collection(self, dim: int, recreate: bool = False) -> None:
        exists = self.client.collection_exists(self.collection)
        if exists and recreate:
            self.client.delete_collection(self.collection)
            exists = False
        if not exists:
            self.client.create_collection(
                self.collection, vectors_config=qm.VectorParams(size=dim, distance=qm.Distance.COSINE)
            )
            try:
                self.client.create_payload_index(self.collection, "book_id", qm.PayloadSchemaType.KEYWORD)
            except Exception:  # local mode ignores payload indexes
                pass

    def delete_book(self, book_id: str) -> None:
        if not self.client.collection_exists(self.collection):
            return
        self.client.delete(
            self.collection,
            points_selector=qm.FilterSelector(
                filter=qm.Filter(must=[qm.FieldCondition(key="book_id", match=qm.MatchValue(value=book_id))])
            ),
        )

    def upsert(self, payloads: Sequence[dict], vectors: np.ndarray, batch: int = 256) -> None:
        for i in range(0, len(payloads), batch):
            pts = [
                qm.PointStruct(id=point_id(p["id"]), vector=vectors[i + j].tolist(), payload=p)
                for j, p in enumerate(payloads[i : i + batch])
            ]
            self.client.upsert(self.collection, points=pts, wait=True)

    def search(self, vector: np.ndarray, book_ids: Sequence[str], limit: int) -> list[tuple[dict, float]]:
        flt = qm.Filter(must=[qm.FieldCondition(key="book_id", match=qm.MatchAny(any=list(book_ids)))])
        res = self.client.query_points(
            self.collection, query=vector.tolist(), query_filter=flt, limit=limit, with_payload=True
        ).points
        return [(p.payload, float(p.score)) for p in res]

    def vectors_for(self, chunk_ids: Sequence[str]) -> dict[str, np.ndarray]:
        if not chunk_ids:
            return {}
        pts = self.client.retrieve(self.collection, ids=[point_id(c) for c in chunk_ids], with_vectors=True, with_payload=True)
        return {p.payload["id"]: np.asarray(p.vector, dtype=np.float32) for p in pts}

    def count(self) -> int:
        if not self.client.collection_exists(self.collection):
            return 0
        return self.client.count(self.collection, exact=True).count
