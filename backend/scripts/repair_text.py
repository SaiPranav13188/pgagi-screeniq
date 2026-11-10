"""One-off migration: apply text-cleaning fixes to an existing index without re-embedding.

Updates the chunk JSONL files (BM25 corpus) and the Qdrant payloads in place. The vectors are
left as they are - the change (joining hyphenated line breaks) is far below what moves an
embedding meaningfully, so a full re-ingest (~45 min on CPU) is unnecessary.
Run with the API stopped (embedded Qdrant holds a file lock).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rag.chunking import dehyphenate  # noqa: E402
from app.rag.lexical import chunks_dir  # noqa: E402
from app.rag.vector_store import VectorStore, point_id  # noqa: E402


def main() -> None:
    store = VectorStore.get()
    changed = 0
    for path in sorted(chunks_dir().glob("*.jsonl")):
        rows = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
        for r in rows:
            fixed = dehyphenate(r["text"])
            if fixed != r["text"]:
                r["text"] = fixed
                store.client.set_payload(store.collection, payload={"text": fixed}, points=[point_id(r["id"])])
                changed += 1
        path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
        print(f"{path.stem}: done")
    VectorStore.close()
    print(f"Repaired {changed} chunks")


if __name__ == "__main__":
    main()
