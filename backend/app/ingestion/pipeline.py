"""Ingestion orchestration: parse → chunk → embed → store."""
from __future__ import annotations

import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.ingestion.chunker import chunk_blocks, chunk_code, approx_tokens
from app.ingestion.github import clone_repository, discover_files, parse_github_url
from app.ingestion.parsers import parse_file
from app.models.knowledge import (
    Chunk,
    CodeFile,
    Document,
    DocumentStatus,
    Incident,
    IndexingStatus,
    Repository,
    SourceType,
)
from app.services.embeddings import get_embedder

logger = logging.getLogger(__name__)
settings = get_settings()

EMBED_BATCH = 64


def _embed_chunks(db: Session, chunks: list[Chunk]) -> None:
    embedder = get_embedder()
    for i in range(0, len(chunks), EMBED_BATCH):
        batch = chunks[i : i + EMBED_BATCH]
        vectors = embedder.embed_texts([c.content for c in batch])
        for chunk, vec in zip(batch, vectors):
            chunk.embedding = vec
        db.flush()


def process_document(document_id: str) -> None:
    """Parse, chunk, embed and store an uploaded document (background task)."""
    db = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if doc is None:
            return
        doc.status = DocumentStatus.processing
        doc.error = None
        db.commit()

        path = Path(doc.storage_url)
        parsed = parse_file(path, doc.file_type)
        raw_chunks = chunk_blocks(parsed.blocks)

        doc.chunks.clear()
        db.flush()
        chunks = [
            Chunk(
                source_type=doc.source_type,
                document_id=doc.id,
                content=c.content,
                token_count=approx_tokens(c.content),
                meta={
                    **c.meta,
                    "title": doc.title,
                    "file_name": doc.file_name,
                    "file_type": doc.file_type,
                },
            )
            for c in raw_chunks
        ]
        db.add_all(chunks)
        _embed_chunks(db, chunks)

        doc.status = DocumentStatus.indexed
        doc.meta = {
            **doc.meta,
            "chunk_count": len(chunks),
            "parsed_title": parsed.title,
        }
        db.commit()
        logger.info("Indexed document %s (%d chunks)", doc.id, len(chunks))
    except Exception as exc:  # noqa: BLE001 — surface failure on the record
        logger.exception("Document processing failed: %s", document_id)
        db.rollback()
        doc = db.get(Document, document_id)
        if doc is not None:
            doc.status = DocumentStatus.failed
            doc.error = str(exc)[:1000]
            db.commit()
    finally:
        db.close()


def index_repository(repository_id: str) -> None:
    """Clone, discover, chunk, embed and store a GitHub repository."""
    db = SessionLocal()
    clone_dir = settings.storage_dir / "repos" / repository_id
    try:
        repo = db.get(Repository, repository_id)
        if repo is None:
            return
        repo.indexing_status = IndexingStatus.indexing
        repo.error = None
        db.commit()

        used_branch = clone_repository(repo.url, clone_dir, repo.branch)
        files = discover_files(clone_dir)

        # Replace old files + chunks (cascades remove chunks).
        for cf in list(repo.code_files):
            db.delete(cf)
        db.flush()

        all_chunks: list[Chunk] = []
        file_records: list[CodeFile] = []
        for f in files:
            cf = CodeFile(
                repository_id=repo.id,
                file_path=f.path,
                language=f.language,
                content=f.content,
                size=f.size,
                meta={},
            )
            db.add(cf)
            db.flush()
            file_records.append(cf)
            for c in chunk_code(f.content, f.language, f.path):
                all_chunks.append(
                    Chunk(
                        source_type=SourceType.code,
                        code_file_id=cf.id,
                        content=c.content,
                        token_count=approx_tokens(c.content),
                        meta={
                            **c.meta,
                            "repository": repo.name,
                            "repository_id": repo.id,
                            "file_path": f.path,
                            "language": f.language,
                            "url": f"{repo.url}/blob/{used_branch}/{f.path}",
                        },
                    )
                )
                if len(all_chunks) >= EMBED_BATCH * 4:
                    db.add_all(all_chunks)
                    _embed_chunks(db, all_chunks)
                    all_chunks = []
        if all_chunks:
            db.add_all(all_chunks)
            _embed_chunks(db, all_chunks)

        repo.indexing_status = IndexingStatus.completed
        repo.last_indexed_at = datetime.now(timezone.utc)
        repo.branch = used_branch
        repo.meta = {
            **repo.meta,
            "file_count": len(file_records),
            "languages": sorted({f.language for f in files if f.language}),
            "local_path": str(clone_dir),
        }
        db.commit()
        logger.info(
            "Indexed repository %s (%d files)", repo.url, len(file_records)
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Repository indexing failed: %s", repository_id)
        db.rollback()
        repo = db.get(Repository, repository_id)
        if repo is not None:
            repo.indexing_status = IndexingStatus.failed
            repo.error = str(exc)[:1000]
            db.commit()
    finally:
        db.close()
        shutil.rmtree(clone_dir, ignore_errors=True)


def index_incident(db: Session, incident: Incident) -> None:
    """Embed an incident's text fields so it joins hybrid retrieval."""
    text = "\n\n".join(
        part for part in [
            f"Incident: {incident.title}",
            f"Severity: {incident.severity.value} | Status: {incident.status.value}",
            f"Affected services: {', '.join(incident.affected_services or [])}",
            incident.description,
            f"Root cause: {incident.root_cause}" if incident.root_cause else "",
            f"Resolution: {incident.resolution}" if incident.resolution else "",
            f"Preventive actions: {incident.preventive_actions}"
            if incident.preventive_actions else "",
        ] if part
    )
    incident.chunks.clear()
    db.flush()
    embedder = get_embedder()
    chunk = Chunk(
        source_type=SourceType.incident,
        incident_id=incident.id,
        content=text,
        token_count=approx_tokens(text),
        embedding=embedder.embed_query(text),
        meta={
            "title": incident.title,
            "severity": incident.severity.value,
            "status": incident.status.value,
            "services": incident.affected_services,
        },
    )
    db.add(chunk)


def delete_document_storage(document: Document) -> None:
    try:
        path = Path(document.storage_url)
        if path.exists():
            path.unlink()
    except OSError:
        logger.warning("Could not delete file %s", document.storage_url)


def repo_local_path(repository_id: str) -> Path:
    return settings.storage_dir / "repos" / repository_id
