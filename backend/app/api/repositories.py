"""GitHub repository connection, indexing, and code browsing."""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.core.database import get_db
from app.ingestion.github import RepoError, parse_github_url
from app.ingestion.pipeline import index_repository
from app.models.knowledge import CodeFile, Repository
from app.models.user import User, UserRole
from app.schemas.knowledge import (
    CodeFileContent,
    CodeFileOut,
    RepoTreeNode,
    RepositoryCreate,
    RepositoryOut,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/repositories", tags=["repositories"])


def _out(db: Session, repo: Repository) -> RepositoryOut:
    count = db.scalar(
        select(func.count()).select_from(CodeFile)
        .where(CodeFile.repository_id == repo.id)
    ) or 0
    data = RepositoryOut.model_validate(repo)
    data.file_count = count
    return data


@router.post("", response_model=RepositoryOut, status_code=201)
def connect_repository(
    payload: RepositoryCreate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    try:
        owner, name = parse_github_url(payload.url)
    except RepoError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    url = f"https://github.com/{owner}/{name}"
    existing = db.scalar(
        select(Repository).where(Repository.url == url)
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Repository already connected")
    repo = Repository(
        name=name, owner=owner, url=url,
        branch=payload.branch or "main", added_by=user.id,
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)
    background.add_task(index_repository, repo.id)
    return _out(db, repo)


@router.get("", response_model=list[RepositoryOut])
def list_repositories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repos = db.scalars(select(Repository).order_by(desc(Repository.created_at)))
    return [_out(db, r) for r in repos]


@router.get("/{repository_id}", response_model=RepositoryOut)
def get_repository(
    repository_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repo = db.get(Repository, repository_id)
    if repo is None:
        raise HTTPException(404, "Repository not found")
    return _out(db, repo)


@router.post("/{repository_id}/index", response_model=RepositoryOut)
def reindex_repository(
    repository_id: str,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    repo = db.get(Repository, repository_id)
    if repo is None:
        raise HTTPException(404, "Repository not found")
    background.add_task(index_repository, repo.id)
    repo.indexing_status = repo.indexing_status  # unchanged until worker flips it
    return _out(db, repo)


@router.delete("/{repository_id}", status_code=204)
def delete_repository(
    repository_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    repo = db.get(Repository, repository_id)
    if repo is None:
        raise HTTPException(404, "Repository not found")
    db.delete(repo)
    db.commit()
    return None


# ---------- File browsing ----------

def _insert_node(root: dict, parts: list[str], language: str | None):
    node = root
    for i, part in enumerate(parts):
        is_file = i == len(parts) - 1
        key = part
        if key not in node["children"]:
            node["children"][key] = {
                "name": part,
                "path": "/".join(parts[: i + 1]),
                "type": "file" if is_file else "dir",
                "language": language if is_file else None,
                "children": {},
            }
        node = node["children"][key]


def _to_tree(node: dict) -> RepoTreeNode:
    children = sorted(
        (_to_tree(c) for c in node["children"].values()),
        key=lambda c: (c.type == "file", c.name),
    )
    return RepoTreeNode(
        name=node["name"], path=node["path"], type=node["type"],
        language=node["language"], children=children,
    )


@router.get("/{repository_id}/tree", response_model=RepoTreeNode)
def repository_tree(
    repository_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repo = db.get(Repository, repository_id)
    if repo is None:
        raise HTTPException(404, "Repository not found")
    root = {"name": repo.name, "path": "", "type": "dir",
            "language": None, "children": {}}
    for cf in db.scalars(
        select(CodeFile).where(CodeFile.repository_id == repo.id)
        .order_by(CodeFile.file_path)
    ):
        _insert_node(root, cf.file_path.split("/"), cf.language)
    return _to_tree(root)


@router.get("/{repository_id}/files", response_model=list[CodeFileOut])
def repository_files(
    repository_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.get(Repository, repository_id) is None:
        raise HTTPException(404, "Repository not found")
    files = db.scalars(
        select(CodeFile).where(CodeFile.repository_id == repository_id)
        .order_by(CodeFile.file_path)
    )
    return [CodeFileOut.model_validate(f) for f in files]


@router.get("/{repository_id}/file", response_model=CodeFileContent)
def repository_file(
    repository_id: str,
    path: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cf = db.scalar(
        select(CodeFile).where(
            CodeFile.repository_id == repository_id,
            CodeFile.file_path == path,
        )
    )
    if cf is None:
        raise HTTPException(404, "File not found in repository")
    return CodeFileContent.model_validate(cf)
