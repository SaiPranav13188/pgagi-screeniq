"""Build-time step for hosted deployments: fetch the prebuilt knowledge base.

The index contains text extracted from copyrighted books, so it is kept out of the public
code repository and stored as a release asset of a *private* repository. The deploy
platform supplies a read-only token via environment variables:

    KB_REPO          owner/name of the private repo           (e.g. SaiPranav13188/pgagi-screeniq-kb)
    KB_ASSET         release asset file name                  (default: kb.tar.gz)
    KB_REPO_TOKEN    fine-grained, read-only GitHub token (Contents: read) for that repo only

It also pre-downloads the embedding model so the first request after a deploy is fast.

    python -m scripts.fetch_kb
"""
from __future__ import annotations

import io
import os
import sys
import tarfile
from pathlib import Path

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


def fetch_index() -> None:
    repo = os.environ.get("KB_REPO")
    token = os.environ.get("KB_REPO_TOKEN")
    asset_name = os.environ.get("KB_ASSET", "kb.tar.gz")
    if (BACKEND / "data" / "index" / "manifest.json").exists():
        print("Knowledge base already present - skipping download")
        return
    if not repo or not token:
        sys.exit("KB_REPO and KB_REPO_TOKEN must be set to fetch the knowledge base")
    gh = httpx.Client(headers={"Authorization": f"Bearer {token}", "X-GitHub-Api-Version": "2022-11-28"}, timeout=120, follow_redirects=True)
    release = gh.get(f"https://api.github.com/repos/{repo}/releases/latest")
    release.raise_for_status()
    asset = next((a for a in release.json()["assets"] if a["name"] == asset_name), None)
    if not asset:
        sys.exit(f"Asset {asset_name} not found in the latest release of {repo}")
    blob = gh.get(asset["url"], headers={"Accept": "application/octet-stream"})
    blob.raise_for_status()
    target = BACKEND / "data"
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(blob.content), mode="r:gz") as tar:
        for m in tar.getmembers():  # refuse path traversal
            if m.name.startswith("/") or ".." in Path(m.name).parts:
                sys.exit(f"Unsafe path in archive: {m.name}")
        tar.extractall(target)
    print(f"Knowledge base extracted to {target} ({len(blob.content) / 1e6:.1f} MB)")


def warm_model() -> None:
    from app.rag.embeddings import Embedder

    Embedder.get()
    print("Embedding model cached")


if __name__ == "__main__":
    fetch_index()
    warm_model()
