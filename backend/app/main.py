"""Engineering Intelligence Hub — FastAPI application entrypoint."""
import logging
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import ai, auth, chat, dashboard, documents, incidents, repositories, search
from app.core.config import get_settings
from app.core.database import init_db

settings = get_settings()

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("eih")

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000",
                   "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Simple sliding-window rate limiter ----------

_buckets: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        window = _buckets[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= settings.rate_limit_per_minute:
            return JSONResponse(
                {"detail": "Rate limit exceeded. Please slow down."},
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        window.append(now)
    return await call_next(request)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    elapsed_ms = (time.monotonic() - start) * 1000
    if request.url.path.startswith("/api/"):
        logger.info(
            "%s %s -> %s (%.0f ms)", request.method, request.url.path,
            response.status_code, elapsed_ms,
        )
    return response


# ---------- Error handling ----------

@app.exception_handler(StarletteHTTPException)
async def http_exc_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exc_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(p) for p in e.get("loc", []) if p != "body"),
         "message": e.get("msg", "invalid")}
        for e in exc.errors()[:10]
    ]
    return JSONResponse(
        {"detail": "Validation error", "errors": errors},
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )


@app.exception_handler(Exception)
async def unhandled_exc_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        {"detail": "An internal error occurred"},
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


# ---------- Startup ----------

@app.on_event("startup")
def startup():
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    try:
        init_db()
    except Exception:
        logger.exception("Database initialization failed — is Postgres running?")


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}


for r in (auth.router, documents.router, repositories.router, incidents.router,
          chat.router, search.router, ai.router, dashboard.router):
    app.include_router(r)
