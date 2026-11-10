"""CLI: build the knowledge base.

    python -m scripts.ingest           # incremental (only changed books)
    python -m scripts.ingest --force   # rebuild everything

Run while the API is stopped when using embedded Qdrant (it holds a file lock),
or use the API endpoint POST /api/v1/knowledge-base/ingest while it is running.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.logging import configure_logging  # noqa: E402
from app.rag.ingest import ingest_all  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingest the role knowledge base")
    ap.add_argument("--force", action="store_true", help="drop the collection and rebuild")
    args = ap.parse_args()
    configure_logging()
    t0 = time.perf_counter()

    def progress(stage: str, data: dict) -> None:
        print(f"  [{stage:>9}] " + ", ".join(f"{k}={v}" for k, v in data.items()), flush=True)

    manifest = ingest_all(force=args.force, progress=progress)
    print(f"\nKnowledge base ready: {manifest['total_chunks']} chunks in {time.perf_counter() - t0:.0f}s")


if __name__ == "__main__":
    main()
