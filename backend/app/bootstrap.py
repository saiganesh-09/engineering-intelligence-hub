"""Container bootstrap: create the schema and optionally seed demo data.

Runs before uvicorn in the container CMD. Set ``SEED_DEMO=1`` to seed a demo
workspace (admin user, sample documents, sample incidents) when the database
is empty — keeps live demos populated on ephemeral storage.
"""
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bootstrap")

from app.core.database import SessionLocal, init_db  # noqa: E402
from app.models.user import User  # noqa: E402

init_db()

if os.environ.get("SEED_DEMO", "").lower() in {"1", "true", "yes"}:
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            logger.info("SEED_DEMO enabled and DB empty — seeding demo data")
            from app import seed

            seed.seed()
        else:
            logger.info("SEED_DEMO enabled but users exist — skipping seed")
    finally:
        db.close()
