"""Global engineering search."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models.knowledge import SourceType
from app.models.user import User
from app.schemas.knowledge import SearchResponse
from app.services.search import search as run_search

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=SearchResponse)
def global_search(
    q: str = Query(min_length=1, max_length=2000),
    source_type: list[SourceType] | None = Query(default=None),
    repository: str | None = None,
    language: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return run_search(
        db, q, source_types=source_type, repository=repository,
        language=language, limit=limit,
    )
