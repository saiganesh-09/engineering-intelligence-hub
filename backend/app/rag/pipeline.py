"""RAG orchestration: retrieve → build context → generate → cite."""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Iterator

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.rag.prompts import RAG_SYSTEM, build_context
from app.rag.retriever import RetrievedChunk, retrieve
from app.services.llm import get_llm

logger = logging.getLogger(__name__)
settings = get_settings()

INSUFFICIENT = (
    "The available engineering knowledge does not provide enough "
    "information to answer this question."
)


@dataclass
class RAGResult:
    answer: str
    sources: list[RetrievedChunk]
    insufficient: bool


def build_messages(
    question: str,
    sources: list[RetrievedChunk],
    history: list[dict] | None = None,
) -> list[dict]:
    context = build_context(sources) if sources else "(no sources retrieved)"
    messages = [{"role": "system", "content": RAG_SYSTEM.format(context=context)}]
    # Include recent turns for conversational continuity (bounded).
    for msg in (history or [])[-8:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})
    return messages


def answer_question(
    db: Session,
    question: str,
    history: list[dict] | None = None,
    source_types=None,
    repository: str | None = None,
    language: str | None = None,
) -> RAGResult:
    sources = retrieve(
        db, question, source_types=source_types,
        repository=repository, language=language,
    )
    if not sources:
        return RAGResult(answer=INSUFFICIENT, sources=[], insufficient=True)
    llm = get_llm()
    answer = llm.generate(build_messages(question, sources, history))
    insufficient = INSUFFICIENT.lower() in answer.lower() or not sources
    return RAGResult(answer=answer, sources=sources, insufficient=insufficient)


def stream_answer(
    db: Session,
    question: str,
    history: list[dict] | None = None,
    source_types=None,
    repository: str | None = None,
    language: str | None = None,
) -> tuple[Iterator[str], list[RetrievedChunk], bool]:
    """Return (token-iterator, sources, insufficient) for SSE streaming."""
    sources = retrieve(
        db, question, source_types=source_types,
        repository=repository, language=language,
    )
    if not sources:
        return iter([INSUFFICIENT]), [], True
    llm = get_llm()
    return (
        llm.stream(build_messages(question, sources, history)),
        sources,
        False,
    )


def cited_source_indices(answer: str, n_sources: int) -> set[int]:
    """Indices (1-based) of sources the answer actually referenced."""
    found = {int(m) for m in re.findall(r"\[(\d+)\]", answer)}
    return {i for i in found if 1 <= i <= n_sources}
