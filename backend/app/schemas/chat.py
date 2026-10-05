"""Schemas for chat, AI capabilities, and citations."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.knowledge import SourceType


class CitationOut(BaseModel):
    id: str
    source_type: SourceType
    source_id: str | None
    chunk_id: str | None
    title: str
    meta: dict

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    citations: list[CitationOut] = []

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = {"from_attributes": True}


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = []


class ChatFilters(BaseModel):
    source_types: list[SourceType] | None = None
    repository: str | None = None
    language: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20000)
    conversation_id: str | None = None
    filters: ChatFilters | None = None
    stream: bool = True


class RetrievedSource(BaseModel):
    chunk_id: str
    source_type: SourceType
    source_id: str | None
    title: str
    path: str | None = None
    repository: str | None = None
    snippet: str
    score: float


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    answer: str
    sources: list[RetrievedSource] = []
    insufficient_context: bool = False


# ---------- Specialized AI ----------

class ExplainCodeRequest(BaseModel):
    code: str | None = Field(default=None, max_length=100000)
    code_file_id: str | None = None
    function_name: str | None = Field(default=None, max_length=300)
    question: str | None = Field(default=None, max_length=2000)


class SummarizeRequest(BaseModel):
    document_id: str | None = None
    text: str | None = Field(default=None, max_length=200000)
    style: Literal["short", "detailed", "key_points", "action_items"] = "short"


class ExplainArchitectureRequest(BaseModel):
    document_id: str | None = None
    repository_id: str | None = None
    topic: str = Field(default="system architecture", max_length=500)


class OnboardingRequest(BaseModel):
    project_id: str | None = None
    repository_id: str | None = None


class AIResult(BaseModel):
    answer: str
    sources: list[RetrievedSource] = []
