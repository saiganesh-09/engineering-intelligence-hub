"""Database engine, session factory, and declarative base."""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

_engine_kwargs: dict = {"pool_pre_ping": True, "future": True}
if settings.database_url.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # pool_recycle protects against suspended/idle connections being reused
    # (serverless/managed Postgres like Neon sleeps the DB between requests).
    _engine_kwargs.update({"pool_size": 10, "max_overflow": 20, "pool_recycle": 300})

engine = create_engine(settings.database_url, **_engine_kwargs)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _):
    """WAL mode lets readers coexist with a writer — avoids the
    reader-blocks-writer deadlock streaming responses can hit."""
    if engine.dialect.name == "sqlite":
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=15000")
        cur.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency yielding a scoped database session."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create extensions + tables. Used for dev bootstrap and tests."""
    with engine.begin() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception:
            # Non-pgvector databases (e.g. SQLite in unit tests) — skip silently.
            pass
    from app import models  # noqa: F401  (ensure models are imported)

    Base.metadata.create_all(bind=engine)
