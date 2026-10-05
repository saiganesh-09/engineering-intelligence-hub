"""Boot helpers: schema init + optional demo seeding.

``maybe_seed()`` runs inside the FastAPI startup hook when ``SEED_DEMO=1``
and seeds a demo workspace (admin user, sample docs, incidents) only when the
database is empty — keeps live demos populated on ephemeral storage. This
module is also invoked directly by container CMDs before uvicorn starts.
"""
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bootstrap")

from app.core.database import SessionLocal, init_db  # noqa: E402
from app.models.user import User  # noqa: E402


def maybe_seed() -> None:
    if os.environ.get("SEED_DEMO", "").lower() not in {"1", "true", "yes"}:
        return
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


if __name__ == "__main__":
    init_db()
    maybe_seed()
