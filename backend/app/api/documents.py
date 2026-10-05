"""Document upload, listing, retrieval, deletion, and re-indexing."""
import logging
import re
from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.ingestion.parsers import SUPPORTED_UPLOAD_EXTENSIONS
from app.ingestion.pipeline import delete_document_storage, process_document, schedule
from app.models.knowledge import Chunk, Document, DocumentStatus, SourceType
from app.models.user import User, UserRole
from app.schemas.knowledge import ChunkOut, DocumentOut

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/api/documents", tags=["documents"])


def _safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", Path(name).name)[:200] or "upload"


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    source_type: SourceType = Form(default=SourceType.document),
    project_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in SUPPORTED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Unsupported file type '{ext}'. Allowed: "
            + ", ".join(sorted(SUPPORTED_UPLOAD_EXTENSIONS)),
        )
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "File is empty")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File exceeds the {settings.max_upload_mb} MB limit",
        )

    doc = Document(
        title=(title or Path(file.filename or "upload").stem).strip()[:500],
        file_name=_safe_name(file.filename or "upload"),
        file_type=ext.lstrip("."),
        source_type=source_type,
        file_size=len(data),
        storage_url="",
        project_id=project_id or None,
        uploaded_by=user.id,
        status=DocumentStatus.pending,
    )
    db.add(doc)
    db.flush()
    dest = settings.storage_dir / "documents" / f"{doc.id}{ext}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    doc.storage_url = str(dest)
    db.commit()
    db.refresh(doc)
    schedule(background, process_document, doc.id)
    return DocumentOut.model_validate(doc)


@router.get("", response_model=list[DocumentOut])
def list_documents(
    status_filter: DocumentStatus | None = Query(default=None, alias="status"),
    source_type: SourceType | None = None,
    project_id: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Document).order_by(desc(Document.created_at))
    if status_filter:
        q = q.where(Document.status == status_filter)
    if source_type:
        q = q.where(Document.source_type == source_type)
    if project_id:
        q = q.where(Document.project_id == project_id)
    return [DocumentOut.model_validate(d) for d in db.scalars(q)]


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(404, "Document not found")
    return DocumentOut.model_validate(doc)


@router.get("/{document_id}/chunks", response_model=list[ChunkOut])
def get_document_chunks(
    document_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.get(Document, document_id) is None:
        raise HTTPException(404, "Document not found")
    chunks = db.scalars(
        select(Chunk).where(Chunk.document_id == document_id)
        .order_by(Chunk.created_at)
    )
    return [ChunkOut.model_validate(c) for c in chunks]


@router.post("/{document_id}/reindex", response_model=DocumentOut)
def reindex_document(
    document_id: str,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(404, "Document not found")
    if not Path(doc.storage_url).exists():
        raise HTTPException(410, "Original file is no longer available")
    doc.status = DocumentStatus.pending
    doc.error = None
    db.commit()
    schedule(background, process_document, doc.id)
    return DocumentOut.model_validate(doc)


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(404, "Document not found")
    delete_document_storage(doc)
    db.delete(doc)
    db.commit()
    return None
