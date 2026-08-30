# ==============================================================================
# GitHub Backup Automation System — Python Agentic Observatory Dockerfile
# ==============================================================================
# Multi-stage build:
#   Stage 1 (builder) : Install uv, sync locked dependencies into .venv.
#   Stage 2 (runtime) : Copy .venv + source into a slim Python 3.14 image.
#
# Build from agentic-observatory/ directory:
#   docker build -t github-backup-observatory .
#
# Or from repo root via docker-compose.yml.
# ==============================================================================

# ── Stage 1: Builder — install uv and sync dependencies ──────────────────────
FROM python:3.14-slim AS builder

# Install uv — the fast Python package manager used by this project
RUN pip install --no-cache-dir uv

WORKDIR /app

# Copy lock files first to maximise cache hits on dependency install
COPY pyproject.toml uv.lock ./

# Sync the exact locked dependency set into a project-local virtual environment.
# --no-install-project : only install dependencies, not the project source itself.
# --no-dev             : skip dev-only dependencies.
RUN uv sync --frozen --no-install-project --no-dev

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.14-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

# Copy the fully resolved virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy the full application source
COPY . .

# Activate the uv-managed venv by prepending to PATH
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

# Run uvicorn with 2 workers — matches local `uv run uvicorn main:app` usage
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
