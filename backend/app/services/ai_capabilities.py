"""Specialized AI capabilities: code explanation, summarization,
architecture analysis, onboarding briefs, incident analysis."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion.chunker import approx_tokens
from app.models.knowledge import (
    CodeFile,
    Chunk,
    Document,
    Incident,
    Repository,
    SourceType,
)
from app.rag.prompts import (
    ARCHITECTURE_SYSTEM,
    EXPLAIN_CODE_SYSTEM,
    INCIDENT_ANALYSIS_SYSTEM,
    ONBOARDING_SYSTEM,
    SUMMARIZE_SYSTEM,
    build_context,
)
from app.rag.retriever import RetrievedChunk, find_similar_incidents, retrieve
from app.schemas.chat import AIResult, RetrievedSource
from app.services.llm import get_llm


def _source_out(s: RetrievedChunk) -> RetrievedSource:
    return RetrievedSource(
        chunk_id=s.chunk_id, source_type=s.source_type, source_id=s.source_id,
        title=s.title, path=s.path, repository=s.repository,
        snippet=s.snippet, score=s.score,
    )


def explain_code(
    db: Session,
    code: str | None = None,
    code_file_id: str | None = None,
    function_name: str | None = None,
    question: str | None = None,
) -> AIResult:
    if code_file_id:
        cf = db.get(CodeFile, code_file_id)
        if cf is None:
            raise HTTPException(404, "Code file not found")
        code = cf.content
        context = f"File: {cf.file_path} ({cf.language or 'unknown'})\n\n{code}"
    elif code:
        context = code
    else:
        raise HTTPException(422, "Provide either 'code' or 'code_file_id'")

    focus = f"Focus on `{function_name}`.\n\n" if function_name else ""
    ask = question or "Explain this code."
    if approx_tokens(context) > 6000:
        context = context[:24000] + "\n\n...[truncated]"
    messages = [
        {"role": "system", "content": EXPLAIN_CODE_SYSTEM},
        {"role": "user", "content": f"{focus}{ask}\n\n```\n{context}\n```"},
    ]
    return AIResult(answer=get_llm().generate(messages))


def summarize_document(
    db: Session,
    document_id: str | None = None,
    text: str | None = None,
    style: str = "short",
) -> AIResult:
    sources: list[RetrievedChunk] = []
    if document_id:
        doc = db.get(Document, document_id)
        if doc is None:
            raise HTTPException(404, "Document not found")
        chunks = db.scalars(
            select(Chunk).where(Chunk.document_id == doc.id).limit(40)
        ).all()
        text = "\n\n".join(c.content for c in chunks)
        title = doc.title
    elif text:
        title = "Provided text"
    else:
        raise HTTPException(422, "Provide either 'document_id' or 'text'")

    if approx_tokens(text) > 8000:
        text = text[:32000] + "\n\n...[truncated]"
    messages = [
        {"role": "system", "content": SUMMARIZE_SYSTEM},
        {"role": "user", "content": f"Style: {style}\n\nDocument: {title}\n\n{text}"},
    ]
    return AIResult(
        answer=get_llm().generate(messages),
        sources=[_source_out(s) for s in sources],
    )


def explain_architecture(
    db: Session,
    document_id: str | None = None,
    repository_id: str | None = None,
    topic: str = "system architecture",
) -> AIResult:
    filters = {}
    repo_name = None
    if repository_id:
        repo = db.get(Repository, repository_id)
        if repo is None:
            raise HTTPException(404, "Repository not found")
        repo_name = repo.name
        filters["repository"] = repo_name
    sources = retrieve(
        db,
        f"{topic} architecture services components data flow dependencies",
        top_k=12, source_types=[
            SourceType.document, SourceType.architecture, SourceType.code,
        ],
        **filters,
    )
    if document_id:
        doc = db.get(Document, document_id)
        if doc is None:
            raise HTTPException(404, "Document not found")
        doc_chunks = db.scalars(
            select(Chunk).where(Chunk.document_id == doc.id).limit(10)
        ).all()
        resolved = {c.id: c for c in doc_chunks}
        extra = [
            RetrievedChunk(
                chunk_id=c.id, source_type=c.source_type, source_id=doc.id,
                title=doc.title, path=doc.file_name, repository=None,
                language=None, content=c.content, snippet=c.content[:600],
                score=1.0, meta=c.meta or {},
            )
            for c in doc_chunks
        ]
        sources = extra + [s for s in sources if s.source_id != doc.id]

    context = build_context(sources[:12]) if sources else "(no sources retrieved)"
    messages = [
        {"role": "system", "content": ARCHITECTURE_SYSTEM},
        {"role": "user", "content":
            f"Topic: {topic}\n\nSOURCES:\n{context}"},
    ]
    return AIResult(
        answer=get_llm().generate(messages),
        sources=[_source_out(s) for s in sources[:12]],
    )


def analyze_incident(db: Session, incident: Incident) -> AIResult:
    similar = find_similar_incidents(db, incident)
    related_docs = retrieve(
        db,
        f"{incident.title} {' '.join(incident.affected_services or [])}",
        top_k=6,
        source_types=[SourceType.document, SourceType.code, SourceType.runbook],
    )
    sources = similar + related_docs
    context = build_context(sources) if sources else "(no related sources)"
    incident_text = (
        f"Title: {incident.title}\nSeverity: {incident.severity.value}\n"
        f"Status: {incident.status.value}\n"
        f"Affected services: {', '.join(incident.affected_services or [])}\n"
        f"Description:\n{incident.description}\n"
        f"Root cause: {incident.root_cause or 'unknown'}\n"
        f"Resolution: {incident.resolution or 'pending'}\n"
        f"Timeline: {incident.timeline or 'n/a'}"
    )
    messages = [
        {"role": "system", "content": INCIDENT_ANALYSIS_SYSTEM},
        {"role": "user", "content":
            f"INCIDENT:\n{incident_text}\n\nRELATED SOURCES:\n{context}"},
    ]
    return AIResult(
        answer=get_llm().generate(messages),
        sources=[_source_out(s) for s in sources],
    )


def onboarding_brief(
    db: Session, project_id: str | None = None, repository_id: str | None = None
) -> AIResult:
    queries = [
        "project overview architecture getting started setup",
        "development setup installation configuration",
        "services components dependencies deployment",
        "common issues troubleshooting runbook",
    ]
    seen: set[str] = set()
    sources: list[RetrievedChunk] = []
    repo_name = None
    if repository_id:
        repo = db.get(Repository, repository_id)
        if repo:
            repo_name = repo.name
    for q in queries:
        for s in retrieve(db, q, top_k=6, repository=repo_name):
            if s.chunk_id not in seen:
                seen.add(s.chunk_id)
                sources.append(s)
    context = build_context(sources[:16]) if sources else "(no sources retrieved)"
    messages = [
        {"role": "system", "content": ONBOARDING_SYSTEM},
        {"role": "user", "content": f"SOURCES:\n{context}"},
    ]
    return AIResult(
        answer=get_llm().generate(messages, max_tokens=3000),
        sources=[_source_out(s) for s in sources[:16]],
    )
