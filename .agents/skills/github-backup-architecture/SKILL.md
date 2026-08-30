---
name: github-backup-architecture
description: >-
  Comprehensive guide to the Docker-first system architecture, container strategy, service communication,
  database schema, and deployment targets (Frontend on Vercel, Python Observatory on Render, Go Backend on Render).
---

# GitHub Backup Automation System — Architecture Guide

This skill provides an overview of the Docker-first system architecture, containerisation strategy, data models, communication protocols, and deployment environments.

## 1. Branch-First Development

> [!IMPORTANT]
> **CREATE A LOCAL BRANCH FIRST**: Always start by creating a local branch from `main`:
> ```bash
> git switch -c MishraShardendu22/main/<feature-name>
> ```
> Never make changes directly on `main`.

---

## 2. System Topology

```
┌─────────────────────────────────────────────────────────────┐
│               Next.js 16 Frontend Container                 │
│          (frontend/Dockerfile → Vercel / Docker)            │
└───────────────┬─────────────────────────────┬───────────────┘
                │ REST / SSE                  │ REST / WebSocket
                ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│  Python Observatory         │ │      Go Backend Container   │
│  Container                  │ │   (backend/Dockerfile)      │
│  (agentic-observatory/      │ │   Fiber v2 · Live WS Stream │
│   Dockerfile) → Render      │ │   → Render Docker Service   │
└───────────────┬─────────────┘ └─────────────┬───────────────┘
                │                             │
                │     ┌─────────────────┐     │
                ├────►│ Neon PostgreSQL │◄────┤
                │     │ (pgvector + FTS)│     │
                │     └────────┬────────┘     │
                │              ▲              │
                │              │ Sync         │
                │     ┌────────┴────────┐     │
                │     │ Backup Worker   │     │
                │     │ Container       │     │
                │     │(backup-worker/  │     │
                │     │ Dockerfile)     │     │
                │     └─────────────────┘     │
                ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│     OpenRouter AI APIs      │ │     SMTP Email Service      │
│ (Multi-Key Failover Pool)   │ │  (Human-In-The-Loop Alerts) │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 3. Container Strategy

| Service | Dockerfile | Runtime Base | Strategy |
|---|---|---|---|
| **Go Backend** | `backend/Dockerfile` | `distroless/static-debian12` | CGO=0 static binary — zero OS attack surface |
| **Python Observatory** | `agentic-observatory/Dockerfile` | `python:3.14-slim` | uv-managed .venv in builder stage; copied to slim runtime |
| **Next.js Frontend** | `frontend/Dockerfile` | `node:20-alpine` | 3-stage: deps → standalone build → minimal runner |
| **Backup Worker** | `backup-worker/Dockerfile` | `alpine:3.22` | CGO=1 (sqlite3); alpine runtime with git + openssh |

### Local Development Orchestration

```bash
# Start all web services
docker compose up

# Run backup worker (one-shot)
docker compose run --rm backup-worker

# Shorthand via Makefile
make docker-up
make docker-backup
```

---

## 4. Service Responsibilities

### Next.js Frontend (`frontend/`)
* **Framework**: Next.js 16 App Router with Turbopack, Tailwind CSS, Biome linter.
* **Responsibilities**: Unified Dashboard, AI Chat Interface, Vector Search Playground, Real-time WebSocket Log Streaming, Human-in-the-Loop Action Approvals.
* **Config**: [`frontend/src/config/env.ts`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/frontend/src/config/env.ts).

### Python Observatory (`agentic-observatory/`)
* **Framework**: FastAPI, LangChain, asyncpg, SQLAlchemy, httpx, Jinja2.
* **Responsibilities**:
  * Multi-turn AI Agent reasoning loop (`invoke_agent`, `stream_agent`).
  * Hybrid Search: PostgreSQL Full-Text Search + pgvector cosine similarity + Reciprocal Rank Fusion (RRF).
  * Automated and interactive embedding generation pipeline (`embedding_generations`, `embedding_jobs`, `embedding_chunks`).
  * Human-in-the-loop report generation and SMTP dispatch (`send_report_email`).
  * JWT Authentication for dashboard chat.
* **Config**: [`agentic-observatory/config/settings.py`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/agentic-observatory/config/settings.py).

### Go Backend (`backend/`)
* **Framework**: Go Fiber v2, pgxpool.
* **Responsibilities**:
  * Ingesting backup execution runs, repository results, and structured logs from the worker.
  * Serving real-time WebSocket hub for active backup runs (`/ws`).
  * Exposing database metrics and telemetry.
* **Config**: [`backend/config/config.go`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/backend/config/config.go).

### Backup Worker (`backup-worker/`)
* **Framework**: Go CLI (`backup-worker/main.go`).
* **Responsibilities**:
  * Discovering repositories from GitHub Organizations & Personal accounts.
  * Cloning / pulling mirrors locally into `backup-worker/_Repos/`.
  * Caching remote HEAD commit hashes in `backup-worker/app.db`.
  * Recording telemetry, logs, and failure fixes to PostgreSQL.
* **Config**: [`backup-worker/config/data.config.go`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/backup-worker/config/data.config.go).
* **Docker volumes required at runtime**:
  * `./backup-worker/_Repos:/app/_Repos`
  * `./backup-worker/app.db:/app/app.db`
  * `~/.ssh:/root/.ssh:ro`

---

## 5. Database Schema

1. `backup_runs`: Stores each backup batch (ID, status, total repos, duration, timestamps, error_message).
2. `backup_results`: Per-repository outcome (status, error_message, sizes, commit_hash).
3. `execution_logs`: Structured step-by-step logs.
4. `analytics_snapshots`: Aggregated metrics and commit snapshots over time (1-to-1 unique with backup_runs).
5. `backup_fixes` & `backup_run_fixes`: Historical failure resolutions and commit tags.
6. `ai_chat_sessions` & `ai_session_metadata`: Normalized conversation sessions and key-value metadata.
7. `ai_chat_messages` & `ai_tool_calls`: Chat history and granular tool execution telemetry.
8. `investigations`: Saved agent investigation traces, tool calls, and results.
9. `embedding_generations`, `embedding_jobs`, `embedding_chunks`: Vector index and chunk storage with pgvector and deterministic blue-green lifecycle management.
