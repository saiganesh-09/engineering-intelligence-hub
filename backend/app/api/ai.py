"""Specialized AI capability endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.chat import (
    AIResult,
    ExplainArchitectureRequest,
    ExplainCodeRequest,
    OnboardingRequest,
    SummarizeRequest,
)
from app.services import ai_capabilities

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/explain-code", response_model=AIResult)
def explain_code(
    payload: ExplainCodeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return ai_capabilities.explain_code(
        db, code=payload.code, code_file_id=payload.code_file_id,
        function_name=payload.function_name, question=payload.question,
    )


@router.post("/summarize", response_model=AIResult)
def summarize(
    payload: SummarizeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return ai_capabilities.summarize_document(
        db, document_id=payload.document_id, text=payload.text,
        style=payload.style,
    )


@router.post("/explain-architecture", response_model=AIResult)
def explain_architecture(
    payload: ExplainArchitectureRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return ai_capabilities.explain_architecture(
        db, document_id=payload.document_id,
        repository_id=payload.repository_id, topic=payload.topic,
    )


@router.post("/onboarding", response_model=AIResult)
def onboarding(
    payload: OnboardingRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return ai_capabilities.onboarding_brief(
        db, project_id=payload.project_id,
        repository_id=payload.repository_id,
    )
