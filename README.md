# Engineering Intelligence Hub

An AI-powered internal knowledge and engineering productivity platform for
software teams. It ingests technical documentation, GitHub repositories, and
incident reports, then answers natural-language engineering questions with
**source-cited, retrieval-grounded** responses — not generic chatbot guesses.

Ask things like:

- *"How does the authentication service communicate with the user service?"*
- *"Why did the payment service fail after the latest deployment?"*
- *"Have we seen this kind of incident before?"*

Answers cite the exact documents, code files, and incident reports they came
from, and the system explicitly says when your knowledge base doesn't contain
enough information — it never fabricates sources.

## Features

- **RAG chat** — streaming answers (SSE), grounded in your indexed knowledge
  with clickable citations and conversation history
- **Hybrid retrieval** — semantic vector search blended with
  keyword/metadata matching, source-type and repository filters
- **Document ingestion** — PDF, Markdown, TXT, DOCX, RST with structure-aware
  chunking (section trees for docs, AST-level chunks for Python code)
- **GitHub integration** — connect a repo, it shallow-clones, filters noise
  (`node_modules`, binaries, generated files…), chunks code by
  function/class, and indexes everything
- **Repository explorer** — file tree, syntax-highlighted code viewer,
  "explain this file" and ask-about-file AI actions
- **Incident intelligence** — structured incident reports that are themselves
  indexed, plus similar-incident retrieval and AI post-mortem analysis
- **Architecture intelligence** — generate dependency/data-flow analysis from
  your real architecture docs and code
- **Onboarding assistant** — generates a practical new-engineer brief from
  your actual docs and repos
- **Global search** — one search box across docs, code, and incidents
- **Dashboard** — knowledge-base stats, recent activity, popular questions,
  failed-index alerts
- **RBAC** — `admin` / `manager` / `developer` roles
- **Offline mode** — deterministic mock LLM + hash embeddings so the whole
  platform runs with zero API keys for development and CI

## Architecture

```
User
 └─ Next.js frontend (React 19, Tailwind v4, shadcn/ui)
     └─ FastAPI backend
         ├─ AuthN/AuthZ        JWT + bcrypt, role-based guards
         ├─ Application APIs   documents / repositories / incidents /
         │                     conversations / search / AI tools / admin
         ├─ RAG pipeline
         │   ├─ Query embedding (provider abstraction)
         │   ├─ Hybrid retrieval: vector cosine + keyword/metadata scoring
         │   ├─ Context construction w/ source metadata
         │   ├─ LLM generation (provider abstraction)
         │   └─ Citation generation — every source is a real stored chunk
         └─ Ingestion pipeline
             ├─ Parsers (md/pdf/txt/docx/rst/code)
             ├─ Structure-aware chunker (section tree / Python AST / lines)
             ├─ Metadata extraction
             └─ Embeddings → chunks table (+pgvector when on Postgres)
```

The database layer is dialect-aware: SQLite works out of the box for local
development; `docker compose` provisions PostgreSQL **with pgvector** for
vector-native similarity search at scale.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), TanStack Query |
| Backend | Python 3.13, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Database | PostgreSQL + pgvector (prod) · SQLite (local dev) |
| AI | OpenAI-compatible LLM & embeddings via env config · pluggable providers |
| Infra | Docker, docker-compose, GitHub Actions |

## Project structure

```
├── frontend/                 # Next.js app
│   ├── app/                  #   App Router pages (landing, auth, (app) group)
│   │   └── (app)/            #     Authenticated: dashboard, chat, search,
│   │                         #     sources, documents, repositories, incidents,
│   │                         #     architecture, onboarding, admin, settings
│   ├── components/           #   UI shell + feature components
│   ├── components/ui/        #   shadcn/ui primitives
│   └── lib/                  #   API client, auth context, types, formatters
├── backend/
│   ├── app/
│   │   ├── api/              #   Routers — thin HTTP layer
│   │   ├── auth/             #   JWT, hashing, RBAC dependencies
│   │   ├── core/             #   Config (pydantic-settings), DB engine/session
│   │   ├── models/           #   SQLAlchemy entities
│   │   ├── schemas/          #   Pydantic request/response models
│   │   ├── services/         #   LLM/embeddings abstractions, search, stats
│   │   ├── rag/              #   Retriever, prompts, pipeline
│   │   ├── ingestion/        #   Parsers, chunker, GitHub clone, pipeline
│   │   └── seed.py           #   Demo data seeder
│   └── tests/                #   pytest suite (31 tests)
├── docs/sample/              #   Sample engineering docs for seeding
├── docker-compose.yml        #   postgres+pgvector, backend, frontend
├── .env.example
└── .github/workflows/ci.yml
```

## Quick start

### Option A — Docker (full stack)

```bash
cp .env.example .env          # fill in secrets
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:8000 · docs at `/docs`

### Option B — Local dev

```bash
# Backend (from repo root so .env resolves)
cp .env.example .env
cd backend && python -m venv .venv && .venv/Scripts/activate  # or source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --app-dir backend --port 8000    # run from repo root

# Frontend
cd frontend && npm install && npm run dev
```

Default local `.env` can simply set `DATABASE_URL=sqlite+pysqlite:///./eih.db` —
SQLite requires no Docker. Leave AI keys empty to run in offline mock mode.

### Demo data

```bash
PYTHONPATH=backend backend/.venv/Scripts/python -m app.seed   # from repo root
```

Creates `admin@eih.dev` / `admin12345`, indexes the four sample docs in
`docs/sample/`, and adds three realistic incident reports (skipped if present).

## Environment variables

See `.env.example` for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://…` or `sqlite+pysqlite:///…` |
| `JWT_SECRET` | Token signing secret (**required in prod**) |
| `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY` / `LLM_BASE_URL` | Chat model — any OpenAI-compatible endpoint works |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` / `EMBEDDING_API_KEY` | Embeddings |
| `GITHUB_TOKEN` | Optional — for private repos + higher rate limits |
| `NEXT_PUBLIC_API_URL` | Frontend → backend base URL |
| `CORS_ORIGINS` / `FRONTEND_URL` | CORS allowlist |
| `RATE_LIMIT_PER_MINUTE` | Per-IP API rate limit |
| `MAX_UPLOAD_MB` | Upload size cap (default 25) |

## Offline / mock mode

If `LLM_API_KEY` is empty the backend uses **MockLLM** — a deterministic
extractive answer generator that still retrieves and cites real sources.
If `EMBEDDING_API_KEY` is empty it uses **HashEmbeddings** — deterministic
hashed bag-of-words vectors, so semantic-ish retrieval works with zero
dependencies. Answers in mock mode are clearly labeled. Everything —
ingestion, chunking, retrieval, citations, streaming — is fully real; only
the generative step is stubbed.

## API overview

Interactive docs: `http://localhost:8000/docs`

| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` |
| Documents | `POST /api/documents/upload` · `GET /api/documents` · `GET /api/documents/{id}` · `GET /api/documents/{id}/chunks` · `POST /api/documents/{id}/reindex` · `DELETE` |
| Repos | `POST /api/repositories` · `GET` · `POST /api/repositories/{id}/index` · `GET /api/repositories/{id}/tree` · `GET /api/repositories/{id}/file?path=` · `GET /api/repositories/{id}/files` |
| Chat | `POST /api/chat` (`stream: true` → SSE: `sources` → `token`… → `done`) · `GET /api/conversations` · `GET/DELETE /api/conversations/{id}` |
| Search | `GET /api/search?q=&source_type=&repository=` |
| Incidents | `POST/GET /api/incidents` · `PATCH/DELETE /{id}` · `POST /{id}/analyze` · `GET /{id}/similar` · `GET /api/incidents/stats/summary` |
| AI tools | `POST /api/ai/explain-code` · `summarize` · `explain-architecture` · `onboarding` |
| Admin | `GET/PATCH /api/admin/users` (admin only) |
| Meta | `GET /api/health` · `GET /api/dashboard/stats` · `GET /api/dashboard/activity` |

## RAG quality notes

- Every chunk carries metadata: source type, title, file path, repository,
  language, section heading path, page numbers (PDF), symbol name (code).
- Hybrid score = `0.7 × cosine_similarity + 0.3 × keyword_overlap`, deduped,
  top-K, with a minimum relevance floor — below it the API answers
  *"the available engineering knowledge does not provide enough information"*.
- The system prompt instructs the model to use **only** retrieved context and
  to cite `[n]` indices; the UI maps those to real stored chunks.
- Undersized sections are merged into neighbors rather than dropped, so no
  content is silently lost during chunking.

## Testing

```bash
cd backend && python -m pytest tests -q      # 31 tests: auth, RBAC, docs,
                                           # chunking, retrieval, chat, search,
                                           # incidents
cd frontend && npm run build                  # typecheck + production build
```

The test suite runs fully offline (SQLite + mock providers) — no keys needed.

## Security

- bcrypt password hashing, short-lived JWTs, role guards on every protected route
- Upload allowlist by extension + MIME + size cap; files stored server-side
- Parameterized queries everywhere (SQLAlchemy)
- Per-IP sliding-window rate limiting
- No secrets in the frontend — AI config lives server-side only
- CORS restricted to configured origins

## Roadmap / future improvements

- Alembic migrations (currently `create_all` on startup)
- Celery/Redis task queue for indexing jobs (currently FastAPI background tasks)
- Qdrant/pgvector-native ANN index for >1M chunks
- OAuth sign-in (GitHub), org/team management UI
- Architecture-diagram image ingestion (OCR/VLM)
- Code re-ranker (cross-encoder) for tighter retrieval
