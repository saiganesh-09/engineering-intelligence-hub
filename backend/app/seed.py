"""Seed the database with demo content: admin user, sample documents,
sample incidents. Idempotent — safe to run repeatedly.

Usage:  python -m app.seed
"""
import logging
import os
from pathlib import Path

from app.auth.security import hash_password
from app.core.database import SessionLocal, init_db
from app.ingestion.pipeline import index_incident, process_document
from app.models.knowledge import (
    Document,
    DocumentStatus,
    Incident,
    IncidentSeverity,
    IncidentStatus,
    SourceType,
)
from app.models.user import User, UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

SAMPLE_DIR = Path(
    os.environ.get("SEED_SAMPLE_DIR")
    or Path(__file__).resolve().parent.parent / "docs" / "sample"
)


def seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        # --- Admin user ---
        admin = db.query(User).filter(User.email == "admin@eih.dev").first()
        if admin is None:
            admin = User(
                name="Admin User", email="admin@eih.dev",
                password_hash=hash_password("admin12345"),
                role=UserRole.admin,
            )
            db.add(admin)
            db.commit()
            logger.info("Created admin user admin@eih.dev / admin12345")
        else:
            logger.info("Admin user already exists")

        # --- Sample documents ---
        if SAMPLE_DIR.exists():
            for path in sorted(SAMPLE_DIR.glob("*.md")):
                exists = db.query(Document).filter(
                    Document.file_name == path.name).first()
                if exists:
                    continue
                doc = Document(
                    title=path.stem.replace("-", " ").title(),
                    file_name=path.name,
                    file_type="md",
                    source_type=(
                        SourceType.runbook if "runbook" in path.name
                        else SourceType.architecture
                        if "architecture" in path.name
                        else SourceType.document
                    ),
                    file_size=path.stat().st_size,
                    storage_url=str(path),
                    uploaded_by=admin.id,
                    status=DocumentStatus.pending,
                )
                db.add(doc)
                db.commit()
                process_document(doc.id)
                logger.info("Seeded + indexed document %s", path.name)
        else:
            logger.warning("Sample dir %s not found — skipping docs", SAMPLE_DIR)

        # --- Sample incidents ---
        if not db.query(Incident).first():
            incidents = [
                Incident(
                    title="Duplicate ledger entries after Kafka consumer lag",
                    severity=IncidentSeverity.high,
                    status=IncidentStatus.resolved,
                    description=(
                        "After deploying ledger-service v2.3 the Kafka consumer "
                        "lagged behind and reprocessed payment.completed events, "
                        "creating duplicate ledger entries for ~340 transactions."
                    ),
                    root_cause=(
                        "Consumer offset was committed after batch processing "
                        "rather than before; a rebalance replayed the batch."
                    ),
                    resolution=(
                        "Committed offsets before processing and added "
                        "idempotency keys on transaction_id."
                    ),
                    preventive_actions="Add consumer lag alerting; idempotent consumers by default.",
                    affected_services=["ledger-service", "payment-service"],
                ),
                Incident(
                    title="Payment API timeouts during Stripe outage",
                    severity=IncidentSeverity.critical,
                    status=IncidentStatus.resolved,
                    description=(
                        "Stripe authorization API returned elevated latency; "
                        "payment-service requests piled up and the connection "
                        "pool exhausted, causing 504s at the gateway."
                    ),
                    root_cause="No circuit breaker on the Stripe client; blocking calls held pool threads.",
                    resolution="Enabled Stripe failover endpoint; added a circuit breaker with 3s timeout.",
                    preventive_actions="Circuit breakers on all third-party clients; load-shed policy on gateway.",
                    affected_services=["payment-service", "api-gateway"],
                ),
                Incident(
                    title="Expired JWT signing key blocked service calls",
                    severity=IncidentSeverity.medium,
                    status=IncidentStatus.closed,
                    description=(
                        "Internal calls began failing with 401s after the JWT "
                        "signing key expired ahead of its scheduled rotation."
                    ),
                    root_cause="Rotation job failed silently when the secrets manager token expired.",
                    resolution="Rotated keys manually; published new JWKS.",
                    preventive_actions="Alert on rotation job failure; monitor key TTL.",
                    affected_services=["auth-service", "api-gateway"],
                ),
            ]
            for inc in incidents:
                db.add(inc)
                db.flush()
                index_incident(db, inc)
            db.commit()
            logger.info("Seeded %d incidents", len(incidents))

        logger.info("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
