---
name: github-backup-architecture
description: >-
  Comprehensive guide to the system architecture, service communication, database schema,
  and deployment targets (Frontend on Vercel, Python Observatory on Vercel, Go Backend on Render).
---

# GitHub Backup Automation System — Architecture Guide

This skill provides an overview of the system architecture, data models, communication protocols, and deployment environments.

---

## 1. System Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 16 Frontend                      │
│                  (Deployed on Vercel)                       │
└───────────────┬─────────────────────────────┬───────────────┘
                │ REST / SSE                  │ REST / WebSocket
                ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│     Python Observatory      │ │         Go Backend          │
│    (Deployed on Vercel)     │ │    (Deployed on Render)     │
│   FastAPI · LangChain AI    │ │  Fiber v2 · Live WS Stream  │
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
                │     │ (CLI / Cron)    │     │
                │     └─────────────────┘     │
                ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│     OpenRouter AI APIs      │ │     SMTP Email Service      │
│ (Multi-Key Failover Pool)   │ │  (Human-In-The-Loop Alerts) │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Service Responsibilities

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

### Backup Worker (`./`)
* **Framework**: Go CLI (`main.go`).
* **Responsibilities**:
  * Discovering repositories from GitHub Organizations & Personal accounts.
  * Cloning / pulling mirrors locally.
  * Recording telemetry, logs, and failure fixes to PostgreSQL.

---

## 3. Database Schema

1. `backup_runs`: Stores each backup batch (ID, status, total repos, duration, timestamps, error_message).
2. `backup_results`: Per-repository outcome (status, error_message, sizes, commit_hash).
3. `execution_logs`: Structured step-by-step logs.
4. `analytics_snapshots`: Aggregated metrics and commit snapshots over time (1-to-1 unique with backup_runs).
5. `backup_fixes` & `backup_run_fixes`: Historical failure resolutions and commit tags.
6. `ai_chat_sessions` & `ai_session_metadata`: Normalized conversation sessions and key-value metadata.
7. `ai_chat_messages` & `ai_tool_calls`: Chat history and granular tool execution telemetry.
8. `investigations`: Saved agent investigation traces, tool calls, and results.
9. `embedding_generations`, `embedding_jobs`, `embedding_chunks`: Vector index and chunk storage with pgvector and deterministic blue-green lifecycle management.

