"""Knowledge entities: documents, chunks, repositories, code files, incidents."""
import enum
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.config import get_settings
from app.core.database import Base
from app.models.base import TimestampMixin, new_uuid, utcnow

_settings = get_settings()

# Portable JSON columns (JSONB on Postgres, JSON elsewhere).
JsonType = MutableDict.as_mutable(JSON().with_variant(JSONB(), "postgresql"))
JsonListType = JSON().with_variant(JSONB(), "postgresql")

# Vector column that degrades to JSON on non-Postgres dialects (e.g. SQLite tests).
EmbeddingType = Vector(_settings.embedding_dimensions).with_variant(JSON(), "sqlite")


class DocumentStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    indexed = "indexed"
    failed = "failed"


class SourceType(str, enum.Enum):
    document = "document"
    code = "code"
    incident = "incident"
    runbook = "runbook"
    architecture = "architecture"
    faq = "faq"


class IndexingStatus(str, enum.Enum):
    pending = "pending"
    indexing = "indexing"
    completed = "completed"
    failed = "failed"


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, native_enum=False), default=SourceType.document, nullable=False
    )
    storage_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, native_enum=False),
        default=DocumentStatus.pending,
        nullable=False,
        index=True,
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict] = mapped_column("metadata", JsonType, default=dict, nullable=False)

    project = relationship("Project", back_populates="documents")
    uploader = relationship("User", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")


class Repository(Base, TimestampMixin):
    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    owner: Mapped[str] = mapped_column(String(300), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    branch: Mapped[str] = mapped_column(String(200), default="main", nullable=False)
    indexing_status: Mapped[IndexingStatus] = mapped_column(
        Enum(IndexingStatus, native_enum=False),
        default=IndexingStatus.pending,
        nullable=False,
        index=True,
    )
    last_indexed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict] = mapped_column("metadata", JsonType, default=dict, nullable=False)
    added_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    code_files = relationship(
        "CodeFile", back_populates="repository", cascade="all, delete-orphan"
    )


class CodeFile(Base):
    __tablename__ = "code_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    repository_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    language: Mapped[str | None] = mapped_column(String(80), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    meta: Mapped[dict] = mapped_column("metadata", JsonType, default=dict, nullable=False)

    repository = relationship("Repository", back_populates="code_files")
    chunks = relationship("Chunk", back_populates="code_file", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_code_files_repo_path", "repository_id", "file_path", unique=True),
    )


class IncidentSeverity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class IncidentStatus(str, enum.Enum):
    open = "open"
    investigating = "investigating"
    resolved = "resolved"
    closed = "closed"


class Incident(Base, TimestampMixin):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    severity: Mapped[IncidentSeverity] = mapped_column(
        Enum(IncidentSeverity, native_enum=False),
        default=IncidentSeverity.medium,
        nullable=False,
        index=True,
    )
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, native_enum=False),
        default=IncidentStatus.open,
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    preventive_actions: Mapped[str | None] = mapped_column(Text, nullable=True)
    timeline: Mapped[str | None] = mapped_column(Text, nullable=True)
    affected_services: Mapped[list] = mapped_column(JsonListType, default=list, nullable=False)
    occurred_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    meta: Mapped[dict] = mapped_column("metadata", JsonType, default=dict, nullable=False)

    chunks = relationship("Chunk", back_populates="incident", cascade="all, delete-orphan")


class Chunk(Base):
    """A retrievable unit of knowledge.

    One chunk belongs to exactly one source (document, code file, or incident),
    referenced through the matching nullable FK. ``meta`` carries section path,
    page numbers, file paths, language, etc. for citation rendering.
    """

    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, native_enum=False), nullable=False, index=True
    )
    document_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    code_file_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("code_files.id", ondelete="CASCADE"), nullable=True, index=True
    )
    incident_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    embedding = mapped_column(EmbeddingType, nullable=True)
    meta: Mapped[dict] = mapped_column("metadata", JsonType, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    document = relationship("Document", back_populates="chunks")
    code_file = relationship("CodeFile", back_populates="chunks")
    incident = relationship("Incident", back_populates="chunks")

    __table_args__ = (
        Index(
            "ix_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
