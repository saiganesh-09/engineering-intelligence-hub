"""Hybrid retrieval: pgvector semantic search + Postgres full-text search,
merged, deduplicated, and ranked."""
from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass, field

from sqlalchemy import Float, and_, cast, desc, func, or_, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.knowledge import Chunk, CodeFile, Document, Incident, SourceType
from app.services.embeddings import get_embedder

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class RetrievedChunk:
    chunk_id: str
    source_type: SourceType
    source_id: str | None
    title: str
    path: str | None
    repository: str | None
    language: str | None
    content: str
    snippet: str
    score: float
    meta: dict = field(default_factory=dict)


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(x * x for x in b)) or 1.0
    return dot / (na * nb)


def _keyword_score(query: str, content: str) -> float:
    """Cheap lexical overlap score for non-Postgres dialects."""
    q = set(re.findall(r"[a-z0-9_]+", query.lower()))
    if not q:
        return 0.0
    c = set(re.findall(r"[a-z0-9_]+", content.lower()))
    return len(q & c) / len(q)


def _resolve_sources(db: Session, chunks: list[Chunk]) -> dict[str, dict]:
    """Batch-load titles/paths for chunks' parent sources."""
    doc_ids = {c.document_id for c in chunks if c.document_id}
    cf_ids = {c.code_file_id for c in chunks if c.code_file_id}
    inc_ids = {c.incident_id for c in chunks if c.incident_id}

    docs = {d.id: d for d in db.scalars(
        select(Document).where(Document.id.in_(doc_ids)))} if doc_ids else {}
    files = {f.id: f for f in db.scalars(
        select(CodeFile).where(CodeFile.id.in_(cf_ids)))} if cf_ids else {}
    incs = {i.id: i for i in db.scalars(
        select(Incident).where(Incident.id.in_(inc_ids)))} if inc_ids else {}
    return {"docs": docs, "files": files, "incidents": incs}


def _to_retrieved(chunk: Chunk, resolved, score: float) -> RetrievedChunk:
    meta = chunk.meta or {}
    title = meta.get("title") or "Untitled"
    path = meta.get("file_path")
    repo = meta.get("repository")
    language = meta.get("language")
    source_id = chunk.document_id or chunk.code_file_id or chunk.incident_id
    if chunk.document_id and chunk.document_id in resolved["docs"]:
        title = resolved["docs"][chunk.document_id].title
        path = resolved["docs"][chunk.document_id].file_name
    elif chunk.code_file_id and chunk.code_file_id in resolved["files"]:
        path = resolved["files"][chunk.code_file_id].file_path
        title = f"{repo or 'repo'}: {path}" if repo else path
    elif chunk.incident_id and chunk.incident_id in resolved["incidents"]:
        title = resolved["incidents"][chunk.incident_id].title
    snippet = chunk.content[:600].strip()
    return RetrievedChunk(
        chunk_id=chunk.id, source_type=chunk.source_type, source_id=source_id,
        title=title, path=path, repository=repo, language=language,
        content=chunk.content, snippet=snippet, score=round(score, 4),
        meta=meta,
    )


def _filters(source_types=None, repository=None, language=None):
    conds = []
    if source_types:
        conds.append(Chunk.source_type.in_(source_types))
    if repository:
        conds.append(Chunk.meta["repository"].astext == repository)
    if language:
        conds.append(Chunk.meta["language"].astext == language)
    return and_(*conds) if conds else None


def retrieve(
    db: Session,
    query: str,
    top_k: int | None = None,
    candidate_k: int | None = None,
    source_types: list[SourceType] | None = None,
    repository: str | None = None,
    language: str | None = None,
) -> list[RetrievedChunk]:
    """Hybrid retrieval: vector similarity + keyword rank, merged & deduped."""
    top_k = top_k or settings.rag_top_k
    candidate_k = candidate_k or settings.rag_candidate_k
    query_vec = get_embedder().embed_query(query)
    where = _filters(source_types, repository, language)

    vec_scores: dict[str, float] = {}
    kw_scores: dict[str, float] = {}
    candidates: dict[str, Chunk] = {}

    dialect = db.bind.dialect.name if db.bind else ""

    if dialect == "postgresql":
        # --- Vector search (cosine distance → similarity) ---
        dist = Chunk.embedding.cosine_distance(query_vec)
        q = select(Chunk, dist.label("dist")).where(Chunk.embedding.isnot(None))
        if where is not None:
            q = q.where(where)
        for chunk, d in db.execute(q.order_by("dist").limit(candidate_k)):
            candidates[chunk.id] = chunk
            vec_scores[chunk.id] = max(0.0, 1.0 - float(d))

        # --- Full-text keyword search ---
        tsq = func.plainto_tsquery("english", query)
        rank = func.ts_rank(func.to_tsvector("english", Chunk.content), tsq)
        q2 = (
            select(Chunk, rank.label("rank"))
            .where(func.to_tsvector("english", Chunk.content).op("@@")(tsq))
        )
        if where is not None:
            q2 = q2.where(where)
        rows = db.execute(q2.order_by(desc("rank")).limit(candidate_k)).all()
        max_rank = max((float(r[1]) for r in rows), default=1.0) or 1.0
        for chunk, r in rows:
            candidates.setdefault(chunk.id, chunk)
            kw_scores[chunk.id] = float(r) / max_rank
    else:
        # --- Portable fallback (SQLite tests): score in Python ---
        q = select(Chunk)
        if where is not None:
            q = q.where(where)
        scored = []
        for chunk in db.scalars(q):
            vs = _cosine(query_vec, chunk.embedding or [])
            ks = _keyword_score(query, chunk.content)
            scored.append((chunk, vs, ks))
        scored.sort(key=lambda t: -(0.7 * t[1] + 0.3 * t[2]))
        for chunk, vs, ks in scored[:candidate_k]:
            candidates[chunk.id] = chunk
            vec_scores[chunk.id] = vs
            kw_scores[chunk.id] = ks

    if not candidates:
        return []

    # Merge scores with weighted sum; prefer vector evidence.
    merged = []
    for cid, chunk in candidates.items():
        score = 0.7 * vec_scores.get(cid, 0.0) + 0.3 * kw_scores.get(cid, 0.0)
        merged.append((chunk, score))

    # Deduplicate: same source + section/page keeps the best chunk only.
    seen: set[tuple] = set()
    deduped = []
    for chunk, score in sorted(merged, key=lambda t: -t[1]):
        key = (
            chunk.document_id or chunk.code_file_id or chunk.incident_id,
            (chunk.meta or {}).get("section"),
            (chunk.meta or {}).get("page_start"),
            (chunk.meta or {}).get("symbol"),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append((chunk, score))
        if len(deduped) >= top_k:
            break

    resolved = _resolve_sources(db, [c for c, _ in deduped])
    return [
        _to_retrieved(chunk, resolved, score)
        for chunk, score in deduped
        if score >= settings.rag_min_score
    ]


def find_similar_incidents(db: Session, incident: Incident, top_k: int = 5):
    """Retrieve other incidents similar to the given one."""
    query = " ".join([
        incident.title, incident.description or "",
        incident.root_cause or "", " ".join(incident.affected_services or []),
    ])[:4000]
    results = retrieve(db, query, top_k=top_k + 1, source_types=[SourceType.incident])
    return [r for r in results if r.source_id != incident.id][:top_k]
