"""Dashboard, projects, and admin user management."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.core.database import get_db
from app.models.org import Project
from app.models.user import User, UserRole
from app.schemas.auth import UpdateUserRequest, UserOut
from app.schemas.knowledge import (
    ActivityItem,
    DashboardStats,
    PopularQuestion,
    ProjectCreate,
    ProjectOut,
)
from app.services.search import dashboard_stats, popular_questions, recent_activity

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard/stats", response_model=DashboardStats)
def stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return dashboard_stats(db, user)


@router.get("/dashboard/activity", response_model=list[ActivityItem])
def activity(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return recent_activity(db, user)


@router.get("/dashboard/popular-questions", response_model=list[PopularQuestion])
def popular(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return popular_questions(db)


# ---------- Projects ----------

@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    return [ProjectOut.model_validate(p) for p in db.scalars(select(Project))]


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    db.delete(project)
    db.commit()
    return None


# ---------- Admin: user management ----------

@router.get("/admin/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    return [UserOut.model_validate(u) for u in db.scalars(select(User))]


@router.patch("/admin/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(UserRole.admin)),
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "User not found")
    updates = payload.model_dump(exclude_unset=True)
    if target.id == admin.id and updates.get("is_active") is False:
        raise HTTPException(400, "You cannot deactivate your own account")
    if target.id == admin.id and updates.get("role") not in (None, UserRole.admin):
        raise HTTPException(400, "You cannot demote your own admin account")
    for field, value in updates.items():
        setattr(target, field, value)
    db.commit()
    db.refresh(target)
    return UserOut.model_validate(target)
