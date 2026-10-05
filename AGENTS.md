# Dev commands (run from repo root)

- Backend server: `backend/.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8000`
- Backend tests:  `cd backend && .venv/Scripts/python -m pytest tests -q`
- Seed data:      `PYTHONPATH=backend backend/.venv/Scripts/python -m app.seed`
- Frontend dev:   `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`

# Conventions

- `.env` lives at repo root (pydantic-settings reads CWD — always run the
  backend/seed from the root). Never commit `.env`.
- Offline dev works with no API keys: `LLM_PROVIDER=mock`,
  `EMBEDDING_PROVIDER=hash` fallbacks engage automatically.
- Database: Postgres+pgvector via `docker compose`, or SQLite locally —
  engine is dialect-aware; SQLite gets WAL + busy_timeout pragmas.
- Backend layering: api → services/rag/ingestion → models. Keep routers thin.
- Frontend: Next.js 16 App Router, shadcn/ui (Base UI variant — use `render`
  prop, not `asChild`; Select `onValueChange` value may be `null`).
