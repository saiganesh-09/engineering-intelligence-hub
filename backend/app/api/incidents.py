"""Incident management + AI incident analysis."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.core.database import get_db
from app.ingestion.pipeline import index_incident
from app.models.knowledge import Incident, IncidentSeverity, IncidentStatus
from app.models.user import User, UserRole
from app.rag.retriever import find_similar_incidents
from app.schemas.chat import AIResult, RetrievedSource
from app.schemas.knowledge import IncidentCreate, IncidentOut, IncidentUpdate
from app.services.ai_capabilities import analyze_incident

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.post("", response_model=IncidentOut, status_code=201)
def create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    incident = Incident(**payload.model_dump(), created_by=user.id)
    db.add(incident)
    db.flush()
    index_incident(db, incident)
    db.commit()
    db.refresh(incident)
    return IncidentOut.model_validate(incident)


@router.get("", response_model=list[IncidentOut])
def list_incidents(
    severity: IncidentSeverity | None = None,
    status_filter: IncidentStatus | None = Query(default=None, alias="status"),
    service: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Incident).order_by(desc(Incident.created_at))
    if severity:
        q = q.where(Incident.severity == severity)
    if status_filter:
        q = q.where(Incident.status == status_filter)
    incidents = list(db.scalars(q))
    if service:
        incidents = [
            i for i in incidents
            if any(service.lower() in s.lower()
                   for s in (i.affected_services or []))
        ]
    return [IncidentOut.model_validate(i) for i in incidents]


@router.get("/stats/summary")
def incident_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    total = db.scalar(select(func.count()).select_from(Incident)) or 0
    by_severity = {
        s.value: db.scalar(select(func.count()).select_from(Incident)
                           .where(Incident.severity == s)) or 0
        for s in IncidentSeverity
    }
    open_count = db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.status.in_([IncidentStatus.open, IncidentStatus.investigating])
        )
    ) or 0
    services: dict[str, int] = {}
    for inc in db.scalars(select(Incident)):
        for svc in inc.affected_services or []:
            services[svc] = services.get(svc, 0) + 1
    top_services = sorted(services.items(), key=lambda t: -t[1])[:8]
    return {
        "total": total,
        "open": open_count,
        "by_severity": by_severity,
        "most_affected_services": [
            {"service": s, "count": c} for s, c in top_services
        ],
    }


@router.get("/{incident_id}", response_model=IncidentOut)
def get_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(404, "Incident not found")
    return IncidentOut.model_validate(incident)


@router.patch("/{incident_id}", response_model=IncidentOut)
def update_incident(
    incident_id: str,
    payload: IncidentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(404, "Incident not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(incident, field, value)
    index_incident(db, incident)
    db.commit()
    db.refresh(incident)
    return IncidentOut.model_validate(incident)


@router.delete("/{incident_id}", status_code=204)
def delete_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(404, "Incident not found")
    db.delete(incident)
    db.commit()
    return None


@router.post("/{incident_id}/analyze", response_model=AIResult)
def analyze(
    incident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(404, "Incident not found")
    return analyze_incident(db, incident)


@router.get("/{incident_id}/similar", response_model=list[RetrievedSource])
def similar_incidents(
    incident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(404, "Incident not found")
    return [
        RetrievedSource(
            chunk_id=r.chunk_id, source_type=r.source_type,
            source_id=r.source_id, title=r.title, path=r.path,
            repository=r.repository, snippet=r.snippet, score=r.score,
        )
        for r in find_similar_incidents(db, incident)
    ]
