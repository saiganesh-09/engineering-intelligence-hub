"""Chat: conversations, messages, citations."""
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, new_uuid, utcnow
from app.models.knowledge import JsonType, SourceType


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), default="New conversation", nullable=False)

    user = relationship("User", back_populates="conversations")
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant | system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    meta: Mapped[dict] = mapped_column("metadata", JsonType, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    conversation = relationship("Conversation", back_populates="messages")
    citations = relationship(
        "Citation", back_populates="message", cascade="all, delete-orphan"
    )


class Citation(Base):
    __tablename__ = "citations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    message_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, native_enum=False), nullable=False
    )
    source_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    chunk_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    title: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    meta: Mapped[dict] = mapped_column("metadata", JsonType, default=dict, nullable=False)

    message = relationship("Message", back_populates="citations")

    __table_args__ = (Index("ix_citations_message", "message_id"),)
