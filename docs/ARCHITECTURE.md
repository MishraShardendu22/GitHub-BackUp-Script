# System Architecture & Technical Specifications

This document outlines the distributed architecture, component boundaries, data flow, vector search pipeline, and deployment topology of the **GitHub Backup Automation & Observatory System**.

---

## 1. High-Level Architecture Topology

All four application services are packaged as Docker images. The managed Neon PostgreSQL database is the only non-containerised component.

```mermaid
graph TD
    subgraph Client Layer
        Browser[Web Browser / User]
    end

    subgraph Docker Containers — Local / Cloud
        Frontend["Next.js 16 App Router\n(frontend/Dockerfile)"]
        Observatory["Python FastAPI AI Observatory\n(agentic-observatory/Dockerfile)"]
        Backend["Go Fiber v2 API Server\n(backend/Dockerfile)"]
        Worker["Go CLI Backup Worker\n(backup-worker/Dockerfile)"]
    end

    subgraph Cloud Storage & Intelligence
        NeonDB[(Neon PostgreSQL + pgvector)]
        GitCentral[Central Backup Git Repository]
        OpenRouter[OpenRouter AI / Free Embedding Registry]
    end

    Browser -->|HTTPS / SSE| Frontend
    Browser -->|SSE Chat / Search| Observatory
    Browser -->|REST / WebSocket| Backend

    Frontend -->|Client Fetch / SSE| Observatory
    Frontend -->|Client Fetch / WS| Backend

    Observatory -->|Async SQLAlchemy / pgvector| NeonDB
    Observatory -->|HTTP Multi-Key Failover| OpenRouter
    Observatory -->|X-Internal-Secret| Backend

    Backend -->|pgxpool / SQL| NeonDB

    Worker -->|Incremental Archiving| GitCentral
    Worker -->|Log / Metrics Ingest| NeonDB
```

---

## 2. Container Architecture

Each service has a purpose-built multi-stage Dockerfile optimised for minimal image size and security.

| Service | Dockerfile | Strategy | Base Image |
|---|---|---|---|
| **Go Backend** | `backend/Dockerfile` | 2-stage: `golang:1.25-alpine` builder → `distroless/static` runtime | `gcr.io/distroless/static-debian12` |
| **Python Observatory** | `agentic-observatory/Dockerfile` | 2-stage: `python:3.14-slim` builder (uv sync) → slim runtime | `python:3.14-slim` |
| **Next.js Frontend** | `frontend/Dockerfile` | 3-stage: deps → Next.js standalone build → `node:20-alpine` runner | `node:20-alpine` |
| **Backup Worker** | `backup-worker/Dockerfile` | 2-stage: `golang:1.25-alpine` builder (CGO + sqlite3) → `alpine` runtime with git/ssh | `alpine:3.22` |

### Docker Compose Orchestration

`docker-compose.yml` at the repository root orchestrates all services for local development:

```
docker compose up        → starts backend, observatory, frontend
docker compose run --rm backup-worker → one-shot backup execution
```

The backup worker is gated behind the `worker` profile and does not start automatically with `docker compose up`.

---

## 3. Core Service Components & Responsibilities

### Tier 1: Frontend Dashboard (Next.js 16 App Router)
* **Deployment**: Docker image (`frontend/Dockerfile`) → Vercel or any container host.
* **Role**: Single-pane-of-glass operations console.
* **Key Features**:
  * **Real-time Live Logs**: WebSocket streaming from Go backend (`/ws/live`).
  * **Search Playground**: Live hybrid query testing with model selection, generation status badges, and score breakdowns.
  * **AI Chat & Investigation Console**: Multi-turn agentic chat with SSE token streaming, thinking visualization, and Human-in-the-Loop (HITL) approval modals.
  * **Analytics & Metrics**: Visual charts for repository sizes, run durations, success rates, and commit trends.

### Tier 2: AI Agentic Observatory (FastAPI + LangChain)
* **Deployment**: Docker image (`agentic-observatory/Dockerfile`) → Render or Vercel Docker runtime.
* **Role**: Cognitive telemetry, vector embeddings, and autonomous incident investigation.
* **Key Features**:
  * **Tool-Calling RAG Pipeline**: Multi-turn agent with dynamic tool invocation (`hybrid_search_knowledge_base`, `fetch_backup_metrics`, `list_backup_runs`, `send_report_email`).
  * **Dynamic OpenRouter Model Registry**: Fetches 100% free embedding and reranking models dynamically with in-memory caching and fallback definitions.
  * **Multi-Key OpenRouter Failover**: Seamless rotation across comma-separated `OPENROUTER_API_KEY`s upon encountering `401`, `402`, or `429`.
  * **Vector Lifecycle Engine**: Blue-Green style index generation (`BUILDING` -> `READY` -> `ACTIVE` -> `RETIRED`) with automatic cascade deletion of stale generations.
  * **Human-In-The-Loop (HITL)**: Sensitive actions yield confirmation tokens (`confirm_id`) requiring user approval before execution.

### Tier 3: High-Performance Backend API (Go 1.24 + Fiber v2)
* **Deployment**: Docker image (`backend/Dockerfile`) → Render (Docker-native web service).
* **Role**: Central data ingest, monitoring REST API, and WebSocket distribution.
* **Key Features**:
  * **Connection Pooling**: `pgxpool` with strict connection limits and timeouts.
  * **Versioned Migrations**: Embedded SQL migration engine (`backend/db/migrator.go`) for zero-downtime idempotent schema updates.
  * **Structured Logging & Metrics**: `log/slog` structured logging and native Prometheus metrics (`/metrics`).
  * **WebSocket Hub**: Concurrent pub-sub hub for broadcasting live worker logs to connected dashboard clients.

### Tier 4: Autonomous Backup Worker (Go 1.24 CLI — `backup-worker/`)
* **Deployment**: Docker image (`backup-worker/Dockerfile`) → run locally or as a scheduled cron (`make docker-backup`).
* **Role**: Repository discovery, delta detection, and secure archiving.
* **Key Features**:
  * **Incremental Sync**: Queries remote repository HEAD hashes via `git ls-remote` and compares with local SQLite state (`backup-worker/app.db`).
  * **Parallel Execution**: Concurrent hash verification and cloning with configurable worker pools (`hashCheckWorkers`, `cloneWorkers`).
  * **Deterministic Archiving**: Shallow clones, `.git` directory stripping, `.tar.gz` compression into `backup-worker/_Repos/`, and atomic serial commits to the central backup repository.
  * **PostgreSQL Telemetry**: Direct batch telemetry logging to PostgreSQL (`execution_logs`, `backup_results`, `backup_runs`).

---

## 4. Vector Search & Tool-Calling RAG Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Admin
    participant UI as Frontend (Next.js)
    participant Agent as Python Observatory
    participant DB as PostgreSQL + pgvector
    participant LLM as OpenRouter AI

    User->>UI: Submit inquiry ("Analyze clone failures")
    UI->>Agent: POST /chat/stream (SSE)
    
    rect rgb(240, 245, 255)
        Note over Agent,DB: Pre-Turn Context Enrichment
        Agent->>DB: Query top relevance chunks (pgvector + FTS)
        DB-->>Agent: Ingest initial context
    end

    Agent->>LLM: Turn 1: System prompt + User question + Injected context
    LLM-->>Agent: Emit tool call: hybrid_search_knowledge_base("clone timeout")
    
    rect rgb(240, 255, 240)
        Note over Agent,DB: Dynamic Tool-Calling RAG
        Agent->>DB: Execute FTS + pgvector Cosine Search + RRF
        alt Chunks not indexed
            Agent->>DB: Query raw live tables directly
        end
        DB-->>Agent: Ranked source chunks
    end

    Agent->>LLM: Turn 2: Feed tool results back to LLM
    LLM-->>Agent: Emit final response tokens
    Agent-->>UI: Stream SSE tokens to UI
    UI-->>User: Display markdown-formatted answer
```

---

## 5. Hybrid Search Architecture

The search engine implements a robust 3-stage retrieval pipeline:

1. **Full-Text Search (FTS) & Trigram Matching**:
   * Utilizes PostgreSQL `tsvector` (`content_tsv`) with `ts_rank_cd` scoring for keyword accuracy.
   * Includes `ILIKE` substring fallback for technical symbols and error codes.
2. **pgvector Semantic Similarity**:
   * Uses cosine distance operator `<=>` against generation-specific embedding vectors.
3. **Reciprocal Rank Fusion (RRF)**:
   * Merges FTS and semantic results using reciprocal rank scoring:
     $$\text{Score}(d) = \frac{w_{\text{fts}}}{k + r_{\text{fts}}(d) + 1} + \frac{w_{\text{sem}}}{k + r_{\text{sem}}(d) + 1}$$
   * Smooths ranking discrepancies and eliminates threshold tuning dependencies.
4. **Live Table Fallback**:
   * If vector index generations are pending or unindexed, automatically falls back to live SQL queries across `execution_logs`, `backup_results`, `investigations`, `backup_fixes`, and `ai_chat_messages`.

---

## 6. Database Schema & Migration Architecture

PostgreSQL serves as the central data store across all services. The Go backend and Python Observatory run idempotent versioned migrations:

### Core Relational & Telemetry Models
1. `backup_runs` & `backup_run_errors`: Execution batches, totals, durations, status, and dedicated error tracking.
2. `backup_results` & `backup_result_errors`: Individual repository outcomes, archive sizes, commit hashes, and dedicated error tracking.
3. `execution_logs`: Structured step-by-step logs with run associations and timestamp indices.
4. `analytics_snapshots`: 1-to-1 repository Git analytics and blob metrics per backup run (`run_id PK`).
5. `backup_fixes`, `backup_run_fixes`, & `backup_fix_commits`: Incident resolutions, run associations, and optional commit tags.
6. `ai_chat_sessions` & `ai_session_metadata`: Multi-turn chat sessions with dedicated normalized metadata.
7. `ai_chat_messages`, `ai_tool_calls`, `ai_tool_call_args`, & `ai_tool_call_errors`: Chat history and granular tool execution telemetry with relational argument and failure tables.
8. `investigations` & `investigation_errors`: Saved agent investigation traces, questions, answers, tool calls, and dedicated failure table.
9. `embedding_generations`, `embedding_chunks`, `embedding_chunk_metadata`, `embedding_jobs`, & `embedding_job_errors`: pgvector vector store and durable work queue with dedicated chunk metadata and failure tables.

### Versioned Migration History
* **`000001_initial_schema`**: Core telemetry tables (`backup_runs`, `backup_results`, `execution_logs`, `analytics_snapshots`, `backup_fixes`).
* **`000002_embeddings_and_search`**: Extensions `vector` & `pg_trgm`, tables `embedding_generations`, `embedding_chunks`, `embedding_jobs`, `embedding_indexing_checkpoints`.
* **`000003_normalize_schema_and_metadata`**: Normalized `ai_session_metadata` table, unique index on analytics `run_id`, empty string cleanup to SQL `NULL`.
* **`000004_cleanup_stale_embeddings_and_errors`**: Obsolete generation pruning and failed job cleanup.
* **`000005_deterministic_embedding_lifecycle`**: Dedicated error tables, primary key deduplication, partial indexes for fast failure/error lookups, commit hash indexes, and transactional blue-green promotion.

---

## 7. Security & Deployment Conventions

* **Non-Destructive Database Migrations**: All migrations must be idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) and preserve historical data.
* **Secrets never baked into images**: All Docker images read configuration exclusively from environment variables (via `env_file:` in Docker Compose or platform environment dashboards on Render/Vercel).
* **Failover Resilience**: Multi-key rotation ensures continuous uptime against LLM provider rate limits.
* **Minimal Attack Surface**: Backend uses `distroless/static` (no shell); Frontend uses non-root `nextjs` user; Observatory runs as default Python user.
