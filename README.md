# GitHub Backup Observatory & Management System

[![CI Pipeline](https://github.com/MishraShardendu22/github-backup/actions/workflows/ci.yml/badge.svg)](https://github.com/MishraShardendu22/github-backup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/Go-1.24%2B-00ADD8?logo=go)](https://go.dev/)
[![Python Version](https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python)](https://python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)

A distributed backup automation and AI-driven telemetry observatory. The system automates repository archiving, stores historical analytics in PostgreSQL, provides live WebSocket streaming, performs hybrid search using pgvector and full-text search, and hosts an AI Agentic Observatory for automated incident analysis and report generation.

---

## Live Resources

- **Production Dashboard**: [github.mishrashardendu22.is-a.dev](https://github.mishrashardendu22.is-a.dev)
- **API Documentation**: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- **Video Walkthrough**: [YouTube Demonstration](https://www.youtube.com/watch?v=be0UBwk2asc)

---

## Architecture & Deployment Model

The system is organized into modular services deployed across **Vercel** and **Render**:

```mermaid
graph TD
    Client[Web Browser / User] -->|HTTPS| Frontend[Next.js Dashboard - Vercel]
    Client -->|HTTPS| PythonAgent[Python Observatory - Vercel]
    Client -->|HTTPS / WSS| GoBackend[Go Fiber Backend - Render]

    GoBackend -->|pgxpool / SQL| PG[(PostgreSQL + pgvector)]
    PythonAgent -->|SQLAlchemy async| PG
    PythonAgent -->|X-Internal-Secret| GoBackend
    PythonAgent -->|HTTPS| OpenRouter[OpenRouter AI / Embeddings]

    Worker[Go CLI Worker] -->|Archives| GitRepos[Central Git Repository]
    Worker -->|Log / Metrics| PG
```

### Components

| Service | Technology | Hosting Platform | Description |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js 16, React 19, Tailwind CSS | **Vercel** | Interactive dashboard with real-time WebSocket feeds, analytics charts, and AI chat playground. |
| **Observatory** | FastAPI, Python 3.12, SQLAlchemy, LangChain | **Vercel** | AI telemetry service with OpenRouter LLM integration, hybrid vector + full-text search, and automated reports. |
| **Backend API** | Go 1.24, Fiber v2, pgxpool | **Render** | High-performance REST and WebSocket API with connection pooling, structured logging (`slog`), and versioned SQL migrations. |
| **Worker Engine** | Go 1.24 CLI | **Local / Cron Worker** | Autonomous CLI backup engine with incremental SHA-HEAD verification, concurrency controls, and `.tar.gz` archiving. |
| **Database** | PostgreSQL 16 + `pgvector` | **Cloud Managed DB** | Persistent relational storage for backup runs, execution logs, analytics snapshots, and embedding vectors. |

---

## Local Development Workflow

Run individual services or the unified development environment using the provided `Makefile`:

```bash
# 1. Start all 3 services concurrently (Go: 8080, Python: 8000, Frontend: 3000)
make dev

# 2. Run all test suites across Go and Python
make test

# 3. Run linters across Go, Python, and TypeScript
make lint

# 4. Build Go binaries and Next.js frontend
make build
```

### Default Port Mappings
- **Frontend Dashboard**: `http://localhost:3000`
- **Go REST API & Metrics**: `http://localhost:8080` (Metrics: `http://localhost:8080/metrics`)
- **Python Observatory**: `http://localhost:8000` (Metrics: `http://localhost:8000/metrics`)

---

## Deployment Configuration

### 1. Frontend (Vercel)
- **Root Directory**: `frontend/`
- **Build Command**: `pnpm run build`
- **Output Directory**: Next.js default (`.next`)
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: Your Render Go backend public URL (e.g. `https://your-backend.onrender.com`)
  - `NEXT_PUBLIC_AGENT_URL`: Your Vercel Python observatory public URL (e.g. `https://your-observatory.vercel.app`)

### 2. Python Observatory (Vercel)
- **Root Directory**: `agentic-observatory/`
- **Environment Variables**:
  - `GO_BACKEND_URL`: URL to your Go Backend on Render
  - `DATABASE_URL`: PostgreSQL async connection string (`postgresql+asyncpg://...`)
  - `INTERNAL_SECRET`: Shared secret matching Go Backend `INTERNAL_SECRET`
  - `OPENROUTER_API_KEY`: OpenRouter API key for LLM and embeddings
  - `JWT_SECRET`: Secret key for JWT session tokens
  - `CHAT_USERNAME` / `CHAT_PASSWORD`: Admin credentials for chat authentication

### 3. Go Backend (Render)
- **Environment**: Go Native Web Service
- **Build Command**: `cd backend && go build -o app main.go`
- **Start Command**: `./backend/app`
- **Environment Variables**:
  - `DATABASE_URL`: PostgreSQL connection string (`postgresql://...`)
  - `INTERNAL_SECRET`: Shared secret for protected endpoints

---

## Database Migrations & Versioning

The Go backend features an embedded versioned migration runner (`backend/db/migrator.go`):

| Version | Migration File | Description |
| :--- | :--- | :--- |
| `000001` | `000001_initial_schema.up.sql` | Core tables (`backup_runs`, `backup_results`, `execution_logs`, `analytics_snapshots`, `backup_fixes`) |
| `000002` | `000002_embeddings_and_search.up.sql` | Extensions `vector` & `pg_trgm`, tables `embedding_generations`, `embedding_chunks`, `embedding_jobs` |

Migrations use non-destructive `CREATE TABLE IF NOT EXISTS` statements and preserve all existing historical data.

---

## Backup & Disaster Recovery

Automate database backups with SHA256 integrity checks:

```bash
# Run backup script (saves to backups/postgres/ with 14-day retention)
make backup-db

# Restore from a backup archive
make restore-db BACKUP_FILE=backups/postgres/gbm_pg_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## Configuration Reference (Secrets & Endpoints)

| Environment Variable | Service | Purpose | Type |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend, Observatory, Worker | PostgreSQL connection string | Secret |
| `INTERNAL_SECRET` | Backend, Observatory | Shared secret for internal API auth | Secret |
| `OPENROUTER_API_KEY` | Observatory | API key for OpenRouter AI | Secret |
| `JWT_SECRET` | Observatory | Secret key for JWT signing | Secret |
| `CHAT_USERNAME` / `CHAT_PASSWORD` | Observatory | Admin credentials for dashboard chat | Secret |
| `GO_BACKEND_URL` | Observatory | URL to deployed Go Backend API | Endpoint |
| `NEXT_PUBLIC_API_URL` | Frontend | URL to deployed Go Backend API | Endpoint |
| `NEXT_PUBLIC_AGENT_URL` | Frontend | URL to deployed Python Observatory | Endpoint |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | Observatory | SMTP email credentials for report dispatch | Secret |
| `SMTP_FROM` / `SMTP_TO` | Observatory | Sender and recipient email addresses | Config |
| `GITHUB_TOKEN_PRIVATE` | Worker CLI | Token for private repo discovery/cloning | Secret |
| `GITHUB_TOKEN_PERSONAL` | Worker CLI | Token for GitHub API rate limits | Secret |

---

## Contributing & License

Contributions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) before submitting pull requests.

Distributed under the MIT License. See `LICENSE` for more information.
