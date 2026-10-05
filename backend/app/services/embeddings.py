"""Embedding provider abstraction.

Providers:
- ``openai``: any OpenAI-compatible ``/embeddings`` endpoint.
- ``local``: sentence-transformers (optional dependency, lazy-loaded).
- ``hash``: deterministic bag-of-words hashing embedder for dev/tests.
  It is weak but consistent, so the pipeline is end-to-end exercisable
  without external API keys.
"""
from __future__ import annotations

import hashlib
import logging
import math
import re

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmbeddingError(RuntimeError):
    pass


class BaseEmbedder:
    dimensions: int

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    def embed_query(self, text: str) -> list[float]:
        return self.embed_texts([text])[0]


class OpenAIEmbeddings(BaseEmbedder):
    def __init__(self, base_url: str, api_key: str, model: str, dimensions: int,
                 timeout: int = 60):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.dimensions = dimensions
        self.timeout = timeout

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            resp = httpx.post(
                f"{self.base_url}/embeddings",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": self.model, "input": texts},
                timeout=self.timeout,
            )
        except httpx.HTTPError as exc:
            raise EmbeddingError(f"Embedding request failed: {exc}") from exc
        if resp.status_code != 200:
            raise EmbeddingError(
                f"Embedding error {resp.status_code}: {resp.text[:500]}"
            )
        data = resp.json()["data"]
        data.sort(key=lambda d: d["index"])
        return [d["embedding"] for d in data]


class LocalEmbeddings(BaseEmbedder):
    """sentence-transformers embeddings (optional dependency)."""

    def __init__(self, model_name: str, dimensions: int):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise EmbeddingError(
                "sentence-transformers is not installed. "
                "Install it or switch EMBEDDING_PROVIDER."
            ) from exc
        self._model = SentenceTransformer(model_name)
        self.dimensions = dimensions

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = self._model.encode(texts, normalize_embeddings=True)
        return [v.tolist() for v in vectors]


_TOKEN_RE = re.compile(r"[a-zA-Z0-9_]+")


class HashEmbeddings(BaseEmbedder):
    """Deterministic hashing embedder — no external calls.

    Builds a term-frequency vector over a fixed hash space with L2
    normalization. Retrieval quality is limited to lexical overlap, but it
    is fully deterministic, making it ideal for tests and offline dev.
    """

    def __init__(self, dimensions: int = 1536):
        self.dimensions = dimensions

    def _vector(self, text: str) -> list[float]:
        vec = [0.0] * self.dimensions
        for tok in _TOKEN_RE.findall(text.lower()):
            h = int.from_bytes(hashlib.blake2b(tok.encode(), digest_size=8).digest(), "big")
            vec[h % self.dimensions] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(t) for t in texts]


def get_embedder() -> BaseEmbedder:
    provider = settings.embedding_provider
    if provider == "openai" and not settings.embedding_api_key:
        logger.warning("EMBEDDING_API_KEY not set — falling back to hash embedder")
        provider = "hash"
    if provider == "openai":
        return OpenAIEmbeddings(
            base_url=settings.embedding_base_url,
            api_key=settings.embedding_api_key,
            model=settings.embedding_model,
            dimensions=settings.embedding_dimensions,
        )
    if provider == "local":
        return LocalEmbeddings(
            model_name=settings.embedding_local_model,
            dimensions=settings.embedding_dimensions,
        )
    return HashEmbeddings(dimensions=settings.embedding_dimensions)
