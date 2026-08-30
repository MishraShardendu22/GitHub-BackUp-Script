---
name: ci-cd-workflow
description: >-
  Rules, architectures, and guidelines for maintaining GitHub Actions CI/CD workflows,
  managing Docker image builds, and orchestrating deployment across Render and Vercel.
---

# CI/CD & Deployment Architecture Skill

This skill guides AI agents and contributors in maintaining GitHub Actions CI pipelines and managing the Docker-first architecture of the **GitHub Backup Automation System**.

## 1. Branch-First Development

> [!IMPORTANT]
> **CREATE A LOCAL BRANCH FIRST**: Always start by creating a local branch from `main`:
> ```bash
> git switch -c MishraShardendu22/main/<feature-name>
> ```
> Never make changes directly on `main`.

---

## 2. Docker-First Architecture

All four services are containerised. Docker is the primary build, test, and deployment mechanism.

```text
┌───────────────────────────┐      ┌───────────────────────────┐
│     Next.js Frontend      │      │    Python Observatory     │
│   (frontend/Dockerfile)   │      │(agentic-observatory/      │
│   Vercel / Container Host │      │ Dockerfile) → Render      │
└─────────────┬─────────────┘      └─────────────┬─────────────┘
              │                                  │
              └───────────────┬──────────────────┘
                              │
              ┌───────────────▼──────────────────┐
              │       Go Backend Dockerfile       │
              │  (backend/Dockerfile) → Render    │
              └───────────────┬──────────────────┘
                              │
              ┌───────────────▼──────────────────┐
              │     PostgreSQL 16 + pgvector     │
              │          (Neon Managed)          │
              └──────────────────────────────────┘
```

### Dockerfiles

| Service | Dockerfile | Build Context |
|---|---|---|
| Go Backend | `backend/Dockerfile` | Repo root |
| Python Observatory | `agentic-observatory/Dockerfile` | `agentic-observatory/` |
| Next.js Frontend | `frontend/Dockerfile` | `frontend/` |
| Backup Worker | `backup-worker/Dockerfile` | Repo root |

### Local Orchestration

All services are orchestrated via `docker-compose.yml` at the repository root:
```bash
make docker-up     # build + start all services
make docker-down   # stop all containers
make docker-build  # rebuild images only
make docker-backup # run backup worker (one-shot)
```

---

## 3. GitHub Actions CI Matrix (`.github/workflows/ci.yml`)

The CI workflow triggers on every `push` and `pull_request` against `main`:

```yaml
jobs:
  backend-test:       # go test -v -race ./... + go build
  observatory-test:   # uv sync + uv run python test_*.py
  frontend-test:      # pnpm install + pnpm lint + pnpm build
  docker-build:       # docker build for all 4 Dockerfiles (GHA cache)
```

The `docker-build` job uses Docker Buildx with GitHub Actions layer caching (`type=gha`) to keep image builds fast.

---

## 4. Local CI Mirroring Runbook

To guarantee that your changes pass CI before committing:

```bash
# 1. Run the pre-commit gate (mirrors native CI checks)
make pre-commit

# 2. Verify all Docker images build
make docker-build

# 3. Run individual CI checks natively if needed:
# Go Backend:
go test -v -race ./... && go build -v ./...

# Python Observatory:
cd agentic-observatory && uv run python test_observability.py \
  && uv run python test_openrouter_keys.py \
  && uv run python test_agent_template.py \
  && uv run python test_agent_suite.py

# Frontend:
cd frontend && pnpm run lint && pnpm run build
```

---

## 5. Secrets vs Centralized Configuration

* **Secrets**: Defined in `.env` files and injected via `env_file:` in Docker Compose or via platform environment dashboards on Render/Vercel.
* **Operational Defaults**: Centralized in code (`backend/config/config.go`, `agentic-observatory/config/settings.py`, `frontend/src/config/env.ts`).
* **Never**: Bake secrets into Docker images or hardcode them in CI workflow YAML.

---

## 6. Adding a New Service or Dockerfile

When adding a new containerised service:
1. Create a `<service>/Dockerfile` with a multi-stage build.
2. Add a `.dockerignore` in the service directory.
3. Add the service to `docker-compose.yml`.
4. Add a `docker build` step to the `docker-build` CI job.
5. Add `make docker-shell-<service>` and `make docker-<service>` targets to `Makefile`.
6. Update `docs/ARCHITECTURE.md` Container Architecture table.
7. Update `.agents/skills/docker-workflow/SKILL.md`.
