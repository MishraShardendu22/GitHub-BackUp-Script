---
name: docker-workflow
description: >-
  Complete guide for the Docker-first development, testing, and deployment workflow.
  Covers Dockerfile patterns for each service, Docker Compose orchestration, volume mounts
  for stateful services, multi-stage build best practices, CI integration, and how to
  add new environment variables or services to the containerised stack.
---

# Docker-First Workflow Skill

This skill is the canonical reference for all Docker-related work on the **GitHub Backup Automation System**. All four services are Docker-first: built, tested, and deployed as container images.

## 1. Branch-First Development

> [!IMPORTANT]
> **CREATE A LOCAL BRANCH FIRST**: Always start by creating a local branch from `main`:
> ```bash
> git switch -c MishraShardendu22/main/<feature-name>
> ```
> Never make changes to Docker configuration or Dockerfiles directly on `main`.

---

## 2. Container Map

| Service | Dockerfile | Build Context | Runtime Base |
|---|---|---|---|
| **Go Backend** | `backend/Dockerfile` | Repo root | `gcr.io/distroless/static-debian12:nonroot` |
| **Python Observatory** | `agentic-observatory/Dockerfile` | `agentic-observatory/` | `python:3.14-slim` |
| **Next.js Frontend** | `frontend/Dockerfile` | `frontend/` | `node:20-alpine` |
| **Backup Worker** | `backup-worker/Dockerfile` | Repo root | `alpine:3.22` |

---

## 3. Docker Compose Quickstart

```bash
# Start all three web services (backend, observatory, frontend)
make docker-up
# Equivalent: docker compose up --build -d

# View live logs
make docker-logs

# Stop all containers
make docker-down

# Run the backup worker (one-shot CLI — exits when done)
make docker-backup
# Equivalent: docker compose run --rm backup-worker

# Open a shell in a running container for debugging
make docker-shell-backend        # sh in Go backend
make docker-shell-observatory    # bash in Python Observatory

# Rebuild all images
make docker-build

# Nuke all containers, images, and volumes
make docker-clean
```

---

## 4. Dockerfile Patterns by Service

### Go Backend (`backend/Dockerfile`)

**Pattern**: 2-stage — `golang:1.25-alpine` builder → `distroless/static` runtime.

Key decisions:
- `CGO_ENABLED=0` for a fully static binary — no shared library dependencies in runtime.
- `distroless/static-debian12:nonroot` runtime — no shell, no package manager, minimal attack surface.
- CA certificates copied from builder for Neon TLS connections.

```dockerfile
# Stage 1: Build
FROM golang:1.25-alpine AS builder
RUN apk add --no-cache ca-certificates git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /app/backend ./backend

# Stage 2: Runtime
FROM gcr.io/distroless/static-debian12:nonroot AS runtime
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/backend /app/backend
EXPOSE 8080
ENTRYPOINT ["/app/backend"]
```

### Python Observatory (`agentic-observatory/Dockerfile`)

**Pattern**: 2-stage — `python:3.14-slim` builder (uv sync) → slim runtime.

Key decisions:
- `uv sync --frozen --no-install-project --no-dev` syncs only production dependencies.
- `.venv` from builder is copied to runtime — virtualenv is self-contained.
- `PATH="/app/.venv/bin:$PATH"` activates the venv without shell source.

```dockerfile
# Stage 1: Dependencies
FROM python:3.14-slim AS builder
RUN pip install uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Stage 2: Runtime
FROM python:3.14-slim AS runtime
COPY --from=builder /app/.venv /app/.venv
COPY . .
ENV PATH="/app/.venv/bin:$PATH"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### Next.js Frontend (`frontend/Dockerfile`)

**Pattern**: 3-stage — deps → builder → `node:20-alpine` runner.

Key decisions:
- `next.config.ts` must set `output: 'standalone'` to enable standalone output mode.
- Only `.next/standalone`, `.next/static`, and `public/` are copied to the runner — no source or `node_modules`.
- Non-root `nextjs` user for security.

```dockerfile
# Stage 1: Deps
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN addgroup --system nodejs && adduser --system --ingroup nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### Backup Worker (`backup-worker/Dockerfile`)

**Pattern**: 2-stage — `golang:1.25-alpine` builder (CGO + git + ssh) → `alpine` runtime.

Key decisions:
- `CGO_ENABLED=1` is required for `mattn/go-sqlite3`.
- Runtime Alpine includes `git` and `openssh-client` for GitHub clone/push.
- Volume mounts at runtime: `_Repos/`, `app.db`, `~/.ssh`.

> [!WARNING]
> Never run the backup worker container AND the native binary simultaneously. Both would write to the same `app.db` SQLite file.

---

## 5. Volume Mounts for the Backup Worker

The backup worker container requires three runtime volume mounts:

```yaml
# In docker-compose.yml or docker run:
volumes:
  - ./backup-worker/_Repos:/app/_Repos     # cloned repo storage
  - ./backup-worker/app.db:/app/app.db     # SQLite incremental state
  - ~/.ssh:/root/.ssh:ro                   # SSH keys (read-only)
```

If `app.db` does not yet exist locally, create it first:
```bash
touch backup-worker/app.db
```

---

## 6. Adding Environment Variables to a Containerised Service

1. Add the variable to the service's `.env` file (never commit real secrets).
2. Add it to the service's `.env.example` with a placeholder.
3. If it's a new Go backend variable, add it to `backend/config/config.go` (`Config` struct + `LoadAndValidate()`).
4. If it's a new Python variable, add it to `agentic-observatory/config/settings.py` (`Settings` class).
5. If it's a new Frontend variable, add it to `frontend/src/config/env.ts`.
6. **Do NOT** add the variable to `docker-compose.yml`'s `environment:` block unless it needs to **override** the `env_file:` value (e.g. internal Docker network hostnames like `GO_BACKEND_URL`).

---

## 7. .dockerignore Conventions

Each service has a `.dockerignore` file that excludes:
- Secrets: `.env`, `.env.*`
- Development artifacts: `node_modules`, `.next`, `__pycache__`, `.venv`
- State files: `_Repos/`, `app.db`
- Documentation: `*.md`, `README*`
- VCS: `.git`, `.gitignore`

---

## 8. CI Integration

The `docker-build` job in `.github/workflows/ci.yml` builds all four Dockerfiles on every PR:

```yaml
docker-build:
  runs-on: ubuntu-latest
  steps:
    - uses: docker/setup-buildx-action@v3
    - run: docker build -f backend/Dockerfile -t github-backup-backend:ci --cache-from type=gha --cache-to type=gha,mode=max .
    - run: docker build -f agentic-observatory/Dockerfile -t github-backup-observatory:ci ... agentic-observatory/
    - run: docker build -f frontend/Dockerfile -t github-backup-frontend:ci ... frontend/
    - run: docker build -f backup-worker/Dockerfile -t github-backup-worker:ci ... .
```

Layer caching via `type=gha` keeps build times fast on repeated runs.

---

## 9. Pre-Commit Hook Integration

When `Dockerfile*` or `docker-compose*.yml` files are staged, the pre-commit hook (`.githooks/pre-commit`) automatically runs a Docker Compose build check (PHASE 4) if Docker daemon is available:

```bash
make pre-commit   # includes Docker validation if Dockerfiles were modified
```

---

## 10. Production Deployment

| Service | Platform | Deploy Method |
|---|---|---|
| Go Backend | **Render** | Docker web service (`backend/Dockerfile`) |
| Python Observatory | **Render** | Docker web service (`agentic-observatory/Dockerfile`) |
| Next.js Frontend | **Vercel** | Native Next.js or Docker image |
| Backup Worker | **Local / Cron** | `docker compose run --rm backup-worker` |
| PostgreSQL | **Neon** | Cloud managed — not containerised |

> [!CAUTION]
> **Never containerise the Neon PostgreSQL database.** The managed Neon instance holds months of production backup history. Replacing it with a local container would permanently sever access to that data.
