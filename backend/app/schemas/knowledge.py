"""Schemas for documents, repositories, incidents, and search."""
from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl

from app.models.knowledge import (
    DocumentStatus,
    IncidentSeverity,
    IncidentStatus,
    IndexingStatus,
    SourceType,
)


# ---------- Documents ----------

class DocumentOut(BaseModel):
    id: str
    title: str
    file_name: str
    file_type: str
    source_type: SourceType
    file_size: int
    status: DocumentStatus
    error: str | None
    project_id: str | None
    meta: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChunkOut(BaseModel):
    id: str
    source_type: SourceType
    content: str
    token_count: int
    meta: dict
    document_id: str | None = None
    code_file_id: str | None = None
    incident_id: str | None = None
    score: float | None = None

    model_config = {"from_attributes": True}


# ---------- Repositories ----------

class RepositoryCreate(BaseModel):
    url: str = Field(min_length=5, max_length=1000)
    branch: str | None = Field(default=None, max_length=200)


class RepositoryOut(BaseModel):
    id: str
    name: str
    owner: str
    url: str
    branch: str
    indexing_status: IndexingStatus
    last_indexed_at: datetime | None
    error: str | None
    meta: dict
    created_at: datetime
    file_count: int = 0

    model_config = {"from_attributes": True}


class CodeFileOut(BaseModel):
    id: str
    repository_id: str
    file_path: str
    language: str | None
    size: int
    meta: dict

    model_config = {"from_attributes": True}


class CodeFileContent(CodeFileOut):
    content: str


class RepoTreeNode(BaseModel):
    name: str
    path: str
    type: str  # "dir" | "file"
    language: str | None = None
    children: list["RepoTreeNode"] = []


# ---------- Incidents ----------

class IncidentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    severity: IncidentSeverity = IncidentSeverity.medium
    status: IncidentStatus = IncidentStatus.open
    description: str = Field(min_length=1)
    root_cause: str | None = None
    resolution: str | None = None
    preventive_actions: str | None = None
    timeline: str | None = None
    affected_services: list[str] = []
    occurred_at: datetime | None = None


class IncidentUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    severity: IncidentSeverity | None = None
    status: IncidentStatus | None = None
    description: str | None = None
    root_cause: str | None = None
    resolution: str | None = None
    preventive_actions: str | None = None
    timeline: str | None = None
    affected_services: list[str] | None = None
    occurred_at: datetime | None = None


class IncidentOut(BaseModel):
    id: str
    title: str
    severity: IncidentSeverity
    status: IncidentStatus
    description: str
    root_cause: str | None
    resolution: str | None
    preventive_actions: str | None
    timeline: str | None
    affected_services: list
    occurred_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Search ----------

class SearchResult(BaseModel):
    chunk_id: str
    source_type: SourceType
    title: str
    snippet: str
    score: float
    document_id: str | None = None
    repository: str | None = None
    file_path: str | None = None
    language: str | None = None
    incident_id: str | None = None
    updated_at: datetime | None = None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    total: int


# ---------- Projects ----------

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    repository_url: str | None = Field(default=None, max_length=500)


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str | None
    repository_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Dashboard ----------

class DashboardStats(BaseModel):
    documents: int
    repositories: int
    incidents: int
    open_incidents: int
    conversations: int
    questions: int
    users: int
    chunks: int
    failed_indexing: int


class ActivityItem(BaseModel):
    kind: str  # document | incident | conversation | repository
    title: str
    timestamp: datetime
    status: str | None = None
    id: str | None = None


class PopularQuestion(BaseModel):
    question: str
    count: int
