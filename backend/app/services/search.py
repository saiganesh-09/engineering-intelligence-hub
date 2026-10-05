"""Search and dashboard services."""
from __future__ import annotations

from collections import Counter

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.chat import Conversation, Message
from app.models.knowledge import (
    Document,
    DocumentStatus,
    Incident,
    IncidentStatus,
    IndexingStatus,
    Repository,
    SourceType,
    Chunk,
)
from app.models.user import User
from app.rag.retriever import retrieve
from app.schemas.knowledge import (
    ActivityItem,
    DashboardStats,
    PopularQuestion,
    SearchResponse,
    SearchResult,
)


def search(
    db: Session,
    query: str,
    source_types: list[SourceType] | None = None,
    repository: str | None = None,
    language: str | None = None,
    limit: int = 20,
) -> SearchResponse:
    retrieved = retrieve(
        db, query, top_k=limit, candidate_k=max(limit * 3, 40),
        source_types=source_types, repository=repository, language=language,
    )
    return SearchResponse(
        query=query,
        total=len(retrieved),
        results=[
            SearchResult(
                chunk_id=r.chunk_id, source_type=r.source_type, title=r.title,
                snippet=r.snippet, score=r.score,
                document_id=r.source_id if r.source_type != SourceType.code else None,
                incident_id=r.source_id if r.source_type == SourceType.incident else None,
                repository=r.repository, file_path=r.path, language=r.language,
            )
            for r in retrieved
        ],
    )


def dashboard_stats(db: Session, user: User) -> DashboardStats:
    def count(model) -> int:
        return db.scalar(select(func.count()).select_from(model)) or 0

    questions = db.scalar(
        select(func.count()).select_from(Message).where(Message.role == "user")
    ) or 0
    open_incidents = db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.status.in_([IncidentStatus.open, IncidentStatus.investigating])
        )
    ) or 0
    failed = (db.scalar(select(func.count()).select_from(Document).where(
        Document.status == DocumentStatus.failed)) or 0) + (
        db.scalar(select(func.count()).select_from(Repository).where(
            Repository.indexing_status == IndexingStatus.failed)) or 0
    )
    return DashboardStats(
        documents=count(Document), repositories=count(Repository),
        incidents=count(Incident), open_incidents=open_incidents,
        conversations=db.scalar(select(func.count()).select_from(Conversation)
                                .where(Conversation.user_id == user.id)) or 0,
        questions=questions, users=count(User), chunks=count(Chunk),
        failed_indexing=failed,
    )


def recent_activity(db: Session, user: User, limit: int = 12) -> list[ActivityItem]:
    items: list[ActivityItem] = []
    for d in db.scalars(select(Document).order_by(desc(Document.created_at)).limit(limit)):
        items.append(ActivityItem(kind="document", title=d.title, id=d.id,
                                  timestamp=d.created_at, status=d.status.value))
    for r in db.scalars(select(Repository).order_by(desc(Repository.updated_at)).limit(limit)):
        items.append(ActivityItem(kind="repository", title=f"{r.owner}/{r.name}",
                                  id=r.id, timestamp=r.updated_at,
                                  status=r.indexing_status.value))
    for i in db.scalars(select(Incident).order_by(desc(Incident.created_at)).limit(limit)):
        items.append(ActivityItem(kind="incident", title=i.title, id=i.id,
                                  timestamp=i.created_at, status=i.status.value))
    for c in db.scalars(
        select(Conversation).where(Conversation.user_id == user.id)
        .order_by(desc(Conversation.updated_at)).limit(limit)
    ):
        items.append(ActivityItem(kind="conversation", title=c.title, id=c.id,
                                  timestamp=c.updated_at))
    items.sort(key=lambda x: x.timestamp or x.timestamp, reverse=True)
    return items[:limit]


def popular_questions(db: Session, limit: int = 8) -> list[PopularQuestion]:
    """Most-asked first messages across conversations."""
    first_msgs = db.execute(
        select(Message.content)
        .where(Message.role == "user")
        .order_by(Message.conversation_id, Message.created_at)
        .distinct(Message.conversation_id)
    ).scalars().all()
    counter = Counter(m.strip()[:200] for m in first_msgs if m.strip())
    return [PopularQuestion(question=q, count=c)
            for q, c in counter.most_common(limit)]
