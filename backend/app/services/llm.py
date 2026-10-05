"""LLM provider abstraction.

Supports any OpenAI-compatible chat-completions endpoint (OpenAI, Azure,
Gemini compatibility mode, vLLM, Ollama, …) plus a ``mock`` provider used
for local development and tests when no API key is configured.
"""
from __future__ import annotations

import logging
from typing import Iterator, Protocol

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ChatMessage(dict):
    """Lightweight dict alias: {"role": ..., "content": ...}."""


class LLMError(RuntimeError):
    pass


class BaseLLM(Protocol):
    def generate(self, messages: list[dict], temperature: float = 0.2,
                 max_tokens: int = 2048) -> str: ...

    def stream(self, messages: list[dict], temperature: float = 0.2,
               max_tokens: int = 2048) -> Iterator[str]: ...


class OpenAICompatibleLLM:
    """Client for any OpenAI-compatible ``/chat/completions`` API."""

    def __init__(self, base_url: str, api_key: str, model: str, timeout: int = 120):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _payload(self, messages, temperature, max_tokens, stream=False):
        return {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }

    def generate(self, messages, temperature=0.2, max_tokens=2048) -> str:
        try:
            resp = httpx.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=self._payload(messages, temperature, max_tokens),
                timeout=self.timeout,
            )
        except httpx.HTTPError as exc:
            raise LLMError(f"LLM request failed: {exc}") from exc
        if resp.status_code != 200:
            raise LLMError(f"LLM error {resp.status_code}: {resp.text[:500]}")
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError) as exc:
            raise LLMError("Unexpected LLM response shape") from exc

    def stream(self, messages, temperature=0.2, max_tokens=2048) -> Iterator[str]:
        try:
            with httpx.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=self._payload(messages, temperature, max_tokens, stream=True),
                timeout=self.timeout,
            ) as resp:
                if resp.status_code != 200:
                    resp.read()
                    raise LLMError(f"LLM error {resp.status_code}: {resp.text[:500]}")
                for line in resp.iter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        import json

                        delta = json.loads(data)["choices"][0].get("delta", {})
                        chunk = delta.get("content")
                        if chunk:
                            yield chunk
                    except (ValueError, KeyError, IndexError):
                        continue
        except httpx.HTTPError as exc:
            raise LLMError(f"LLM stream failed: {exc}") from exc


class MockLLM:
    """Deterministic offline LLM for development without an API key.

    Produces an extractive, context-grounded answer so the rest of the
    pipeline (retrieval, citations, streaming) is fully exercisable.
    """

    def _answer(self, messages: list[dict]) -> str:
        user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        system = messages[0]["content"] if messages else ""
        # The RAG prompt embeds numbered context blocks; echo the leading
        # sentences of each block so answers are grounded in real sources.
        import re

        blocks = re.findall(r"\[(\d+)\] [^\n]*\n((?:.+\n?)+?)(?=\n\[\d+\]|\Z)", system)
        lines = [f"**Question:** {user}\n"]
        if not blocks:
            lines.append(
                "The available engineering knowledge does not provide enough "
                "information to answer this question."
            )
        else:
            lines.append("Based on the retrieved engineering sources:\n")
            for num, body in blocks[:5]:
                sentences = re.split(r"(?<=[.!?])\s+", body.strip())
                excerpt = " ".join(sentences[:2])[:400]
                lines.append(f"- {excerpt} [{num}]")
            lines.append(
                "\n*Mock LLM is active (no API key configured). Answers are "
                "extractive summaries of retrieved context.*"
            )
        return "\n".join(lines)

    def generate(self, messages, temperature=0.2, max_tokens=2048) -> str:
        return self._answer(messages)

    def stream(self, messages, temperature=0.2, max_tokens=2048) -> Iterator[str]:
        answer = self._answer(messages)
        for i in range(0, len(answer), 24):
            yield answer[i : i + 24]


def get_llm() -> BaseLLM:
    if settings.llm_provider == "mock" or not settings.llm_api_key:
        if settings.llm_provider != "mock" and not settings.llm_api_key:
            logger.warning("LLM_API_KEY not set — falling back to mock LLM")
        return MockLLM()
    return OpenAICompatibleLLM(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        model=settings.llm_model,
        timeout=settings.llm_timeout_seconds,
    )
