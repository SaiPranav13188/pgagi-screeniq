"""LLM provider abstraction.

Services depend on the small `LLMClient` protocol, never on a vendor SDK. Gemini is
called over its REST API with JSON-mode output, a model fallback chain (404 / quota
errors move on to the next model) and bounded retries with exponential backoff.

When no key is configured (or every model fails) `get_llm()` returns None / services
catch `LLMError`, and each pipeline stage falls back to a deterministic, retrieval-
grounded implementation. The system therefore always completes an interview, and
every artefact records which generator produced it.
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time
from typing import Any, Protocol

import httpx

from app.core.config import get_settings
from app.core.errors import LLMError

log = logging.getLogger(__name__)
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class LLMClient(Protocol):
    name: str

    def generate_json(self, system: str, prompt: str, *, temperature: float | None = None) -> dict[str, Any]: ...


class GeminiClient:
    def __init__(self, api_key: str, models: list[str]) -> None:
        s = get_settings()
        self.api_key = api_key
        self.models = models
        self.thinking_level = s.gemini_thinking_level
        self.temperature = s.llm_temperature
        self.max_retries = s.llm_max_retries
        self._http = httpx.Client(timeout=s.llm_timeout_seconds)
        self._dead_models: set[str] = set()
        self._no_thinking: set[str] = set()
        self._cooldown: dict[str, float] = {}
        self._lock = threading.Lock()
        self.last_model: str | None = None

    @property
    def name(self) -> str:
        return f"gemini:{self.last_model or self.models[0]}"

    def _body(self, model: str, system: str, prompt: str, temperature: float) -> dict:
        cfg: dict[str, Any] = {"temperature": temperature, "responseMimeType": "application/json"}
        if self.thinking_level and model not in self._no_thinking and not model.startswith("gemini-2"):
            cfg["thinkingConfig"] = {"thinkingLevel": self.thinking_level}
        return {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": cfg,
        }

    def generate_json(self, system: str, prompt: str, *, temperature: float | None = None) -> dict[str, Any]:
        temperature = self.temperature if temperature is None else temperature
        errors: list[str] = []
        now = time.monotonic()
        candidates = [m for m in self.models if m not in self._dead_models and self._cooldown.get(m, 0) <= now]
        if not candidates:  # everything cooling down: try the least-recently-failed anyway
            candidates = sorted((m for m in self.models if m not in self._dead_models), key=lambda m: self._cooldown.get(m, 0))
        for model in candidates:
            for attempt in range(self.max_retries + 1):
                try:
                    r = self._http.post(
                        GEMINI_URL.format(model=model),
                        headers={"x-goog-api-key": self.api_key},
                        json=self._body(model, system, prompt, temperature),
                    )
                except httpx.TimeoutException:
                    # A model that stalls is usually overloaded: don't retry it, move on.
                    errors.append(f"{model}: timeout")
                    self._cooldown[model] = time.monotonic() + 300
                    break
                except httpx.HTTPError as e:
                    errors.append(f"{model}: network {e.__class__.__name__}")
                    time.sleep(0.8 * (2**attempt))
                    continue
                if r.status_code == 200:
                    text = _extract_text(r.json())
                    try:
                        data = parse_json(text)
                    except ValueError:
                        errors.append(f"{model}: unparseable JSON")
                        continue
                    self.last_model = model
                    return data
                body = r.text[:300]
                if r.status_code == 400 and "thinking" in body.lower() and model not in self._no_thinking:
                    self._no_thinking.add(model)
                    continue
                if r.status_code in (404, 403) or (r.status_code == 400 and "not found" in body.lower()):
                    with self._lock:
                        self._dead_models.add(model)
                    errors.append(f"{model}: {r.status_code} unavailable")
                    break
                if r.status_code == 429 or r.status_code >= 500:
                    errors.append(f"{model}: {r.status_code}")
                    if r.status_code == 503 or attempt >= self.max_retries:
                        # Overloaded / quota exhausted: skip this model for a while and fall
                        # through to the next one immediately, keeping the interview responsive.
                        self._cooldown[model] = time.monotonic() + 120
                        break
                    time.sleep(1.2 * (2**attempt))
                    continue
                if r.status_code in (401,) or "API key not valid" in body:
                    raise LLMError("Gemini rejected the API key (check GEMINI_API_KEY)")
                errors.append(f"{model}: {r.status_code} {body[:120]}")
                break
        raise LLMError("All Gemini models failed: " + "; ".join(errors[-6:]))


def _extract_text(payload: dict) -> str:
    try:
        parts = payload["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError):
        reason = payload.get("promptFeedback", {}).get("blockReason") or payload.get("candidates", [{}])[0].get("finishReason")
        raise LLMError(f"Gemini returned no content ({reason})")
    return "".join(p.get("text", "") for p in parts if not p.get("thought"))


def parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise ValueError("no JSON object found")
        data = json.loads(m.group(0))
    if isinstance(data, list):
        # Models sometimes wrap the requested object in a one-element array.
        data = data[0] if len(data) == 1 and isinstance(data[0], dict) else {"items": data}
    if not isinstance(data, dict):
        raise ValueError("JSON root is not an object")
    return data


_client: GeminiClient | None = None
_client_lock = threading.Lock()


def get_llm() -> LLMClient | None:
    """Configured LLM, or None in offline mode."""
    global _client
    s = get_settings()
    if not s.llm_enabled:
        return None
    with _client_lock:
        if _client is None:
            _client = GeminiClient(s.gemini_api_key or "", s.gemini_model_list)
        return _client


def llm_status() -> dict:
    s = get_settings()
    if not s.llm_enabled:
        return {"provider": "offline", "enabled": False, "models": [], "active_model": None}
    c = get_llm()
    return {
        "provider": "gemini",
        "enabled": True,
        "models": s.gemini_model_list,
        "active_model": getattr(c, "last_model", None),
        "unavailable_models": sorted(getattr(c, "_dead_models", set())),
    }
