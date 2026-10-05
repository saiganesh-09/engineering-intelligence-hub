"""Chat endpoints: conversations, messages, streaming RAG answers."""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.database import SessionLocal, get_db
from app.models.chat import Citation, Conversation, Message
from app.models.user import User
from app.rag.pipeline import answer_question, cited_source_indices, stream_answer
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationDetail,
    ConversationOut,
    MessageOut,
    RetrievedSource,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["chat"])


def _conversation_or_404(db: Session, cid: str, user: User) -> Conversation:
    conv = db.get(Conversation, cid)
    if conv is None or conv.user_id != user.id:
        raise HTTPException(404, "Conversation not found")
    return conv


def _history(db: Session, conversation_id: str) -> list[dict]:
    msgs = db.scalars(
        select(Message).where(Message.conversation_id == conversation_id)
        .order_by(desc(Message.created_at)).limit(8)
    ).all()
    return [
        {"role": m.role, "content": m.content[:4000]}
        for m in reversed(msgs)
    ]


def _save_turn(db: Session, conv: Conversation, question: str,
               answer: str, sources, insufficient: bool) -> Message:
    if conv.title == "New conversation":
        conv.title = question.strip()[:80] or conv.title
    assistant = Message(
        conversation_id=conv.id, role="assistant", content=answer,
        meta={"insufficient_context": insufficient},
    )
    db.add(assistant)
    db.flush()
    referenced = cited_source_indices(answer, len(sources))
    for i, s in enumerate(sources):
        # Persist every retrieved source; mark which were explicitly cited.
        db.add(Citation(
            message_id=assistant.id, source_type=s.source_type,
            source_id=s.source_id, chunk_id=s.chunk_id, title=s.title,
            meta={
                "path": s.path, "repository": s.repository,
                "snippet": s.snippet, "score": s.score,
                "cited": (i + 1) in referenced if referenced else True,
                **{k: v for k, v in (s.meta or {}).items()
                   if k in ("section", "page_start", "page_end",
                            "language", "url", "symbol", "line_start")},
            },
        ))
    db.commit()
    db.refresh(assistant)
    return assistant


def _sources_payload(sources) -> list[dict]:
    return [
        RetrievedSource(
            chunk_id=s.chunk_id, source_type=s.source_type,
            source_id=s.source_id, title=s.title, path=s.path,
            repository=s.repository, snippet=s.snippet, score=s.score,
        ).model_dump(mode="json")
        for s in sources
    ]


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    filters = payload.filters
    if payload.conversation_id:
        conv = _conversation_or_404(db, payload.conversation_id, user)
    else:
        conv = Conversation(user_id=user.id)
        db.add(conv)
        db.flush()
    db.add(Message(conversation_id=conv.id, role="user",
                   content=payload.message))
    db.commit()

    history = _history(db, conv.id)
    kwargs = dict(
        source_types=filters.source_types if filters else None,
        repository=filters.repository if filters else None,
        language=filters.language if filters else None,
    )

    if payload.stream:
        tokens, sources, insufficient = stream_answer(
            db, payload.message, history, **kwargs
        )
        conv_id = conv.id

        def event_stream():
            full: list[str] = []
            yield ("event: sources\n"
                   f"data: {json.dumps(_sources_payload(sources))}\n\n")
            try:
                for token in tokens:
                    full.append(token)
                    yield f"data: {json.dumps(token)}\n\n"
            except Exception as exc:  # noqa: BLE001
                logger.exception("Chat streaming failed")
                yield ("event: error\n"
                       f"data: {json.dumps('AI provider error: ' + str(exc)[:300])}\n\n")
            finally:
                sdb = SessionLocal()
                try:
                    sconv = sdb.get(Conversation, conv_id)
                    if sconv is not None:
                        msg = _save_turn(
                            sdb, sconv, payload.message,
                            "".join(full) or "(no answer generated)",
                            sources, insufficient,
                        )
                        yield ("event: done\n"
                               f"data: {json.dumps({'message_id': msg.id, 'conversation_id': conv_id})}\n\n")
                finally:
                    sdb.close()

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    result = answer_question(db, payload.message, history, **kwargs)
    msg = _save_turn(db, conv, payload.message, result.answer,
                     result.sources, result.insufficient)
    return ChatResponse(
        conversation_id=conv.id, message_id=msg.id, answer=result.answer,
        sources=[RetrievedSource(**s) for s in _sources_payload(result.sources)],
        insufficient_context=result.insufficient,
    )


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    convs = db.scalars(
        select(Conversation).where(Conversation.user_id == user.id)
        .order_by(desc(Conversation.updated_at))
    ).all()
    out = []
    for c in convs:
        count = db.scalar(
            select(func.count()).select_from(Message)
            .where(Message.conversation_id == c.id)
        ) or 0
        item = ConversationOut.model_validate(c)
        item.message_count = count
        out.append(item)
    return out


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = _conversation_or_404(db, conversation_id, user)
    detail = ConversationDetail.model_validate(conv)
    detail.message_count = len(conv.messages)
    detail.messages = [MessageOut.model_validate(m) for m in conv.messages]
    return detail


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = _conversation_or_404(db, conversation_id, user)
    db.delete(conv)
    db.commit()
    return None
