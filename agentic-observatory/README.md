# Backup Observatory - AI Agentic & Vector Intelligence Layer

The **Agentic Observatory** is a production FastAPI service providing autonomous incident analysis, LangChain tool-calling RAG, pgvector hybrid search, dynamic OpenRouter model failover, and automated incident reporting for the GitHub Backup System.

---

## 🛠️ Tech Stack & Key Libraries

- **Framework**: FastAPI + Uvicorn (ASGI)
- **AI & RAG**: LangChain Core, OpenRouter Multi-Model Gateway
- **Vector Search**: PostgreSQL 16 + `pgvector`, SQLAlchemy (asyncpg)
- **Type Checking & Tooling**: Python 3.12+, `uv`, Pyright

---

## 🚀 Key Features

### 1. Dual-Layer Tool-Calling RAG
* **Pre-Turn Retrieval**: Proactively pulls top relevance chunks across previous logs and backup results to prime system context.
* **Dynamic Tool Calling**: The agent dynamically invokes tools during multi-step reasoning:
  * `hybrid_search_knowledge_base`: Queries pgvector + FTS with Reciprocal Rank Fusion across logs, results, fixes, and past investigations.
  * `fetch_backup_metrics`: Real-time success rates, repository counts, and duration metrics.
  * `list_backup_runs`: Paginated historical backup runs.
  * `send_report_email`: Generates and dispatches executive summaries via SMTP (protected by HITL).

### 2. Dynamic OpenRouter Model Registry & Multi-Key Failover
* **Dynamic Registry**: Queries OpenRouter API with `output_modalities=embeddings` and `output_modalities=rerank` to find 100% free models dynamically with in-memory caching and fallback definitions.
* **Multi-Key Failover**: Supports comma-separated `OPENROUTER_API_KEY`s. If an API key encounters `401`, `402`, or `429`, the system automatically rotates to the next available key without failing user requests.

### 3. Blue-Green Vector Lifecycle & Automated Pruning
* **Generations**: Manages embedding generations (`BUILDING` -> `READY` -> `ACTIVE` -> `RETIRED`).
* **Chunking**: Sliding-window chunking (default 500 characters with 50 character overlap) with SHA-256 deduplication and contextual metadata (`repository`, `status`, `level`, `author`).
* **Automated Pruning**: Activating a new generation automatically cascade-deletes older `RETIRED` and `FAILED` generations to conserve Neon PostgreSQL storage.

### 4. Human-In-The-Loop (HITL) Protocol
* Outward-facing actions (e.g. sending report emails) yield a `confirm_required` event over SSE with a `confirm_id`.
* The frontend displays an approval modal, and the user approves or rejects via `POST /chat/confirm`.

---

## 💻 Local Development

### Prerequisites
- Python 3.12+
- `uv` (fast Python package manager)

### Installation
```bash
cd agentic-observatory
uv sync
```

### Running Locally
```bash
# Start FastAPI with hot reload on port 8000
uv run uvicorn main:app --reload --port 8000
```

### Running Tests & Type Checks
```bash
# 1. Run all unit and observability tests
uv run python test_observability.py
uv run python test_openrouter_keys.py

# 2. Run comprehensive AI Agent & Tool-Calling RAG suite
uv run python test_agent_suite.py

# 3. Run Pyright static type checker
uv run --with pyright pyright
```

---

## 📁 Package Architecture

```text
agentic-observatory/
├── main.py                  # FastAPI server entry point, routes, SSE endpoints
├── agent/
│   ├── openrouter.py        # LangChain tool-calling agent loop, streaming, HITL
│   ├── prompts.py           # System prompts, guardrails, role guidelines
│   └── state.py             # Agent execution state schemas
├── config/
│   └── settings.py          # Centralized configuration & environment loader
├── data/
│   ├── db.py                # Async SQLAlchemy engine & async_sessionmaker
│   ├── embedding_models.py  # OpenRouter dynamic free model registry & fallback cache
│   ├── embeddings.py        # Chunking, vector embedding generation & pruning
│   ├── search.py            # FTS + pgvector hybrid search & RRF ranking
│   ├── persistence.py       # Session metadata & message storage
│   ├── go_backend.py        # Go backend HTTP client
│   └── tools/               # LangChain tool implementations
│       ├── search.py        # hybrid_search_knowledge_base
│       ├── analytics.py     # fetch_backup_metrics
│       ├── backup.py        # list_backup_runs
│       └── reports.py       # send_report_email
└── utils/
    ├── env.py               # Safe environment variable parsing
    ├── logging.py           # Structured logger
    ├── metrics.py           # Prometheus observatory metrics
    ├── openrouter_keys.py   # Multi-key failover manager
    ├── auth.py              # JWT authentication utilities
    └── response.py          # Unified HTTP response wrappers
```

---

## 🔒 Configuration & Secrets

Set the following in `.env` or your Vercel deployment dashboard:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL asyncpg URL (`postgresql+asyncpg://...`) |
| `OPENROUTER_API_KEY` | OpenRouter API key(s), comma-separated for failover |
| `INTERNAL_SECRET` | Shared secret matching Go backend `INTERNAL_SECRET` |
| `JWT_SECRET` | Secret key for JWT session tokens |
| `GO_BACKEND_URL` | Deployed Go Backend API URL |
| `OPENROUTER_MODEL` | Default reasoning LLM (e.g. `deepseek/deepseek-chat`) |
| `OPENROUTER_EMBEDDING_MODEL` | Default embedding model (e.g. `google/text-embedding-004`) |