---
name: ci-cd-workflow
description: >-
  Rules, architectures, and guidelines for maintaining GitHub Actions CI/CD workflows,
  managing deployment boundaries on Vercel and Render, and ensuring zero-containerization compliance.
---

# CI/CD & Deployment Architecture Skill

This skill guides AI agents and contributors in maintaining GitHub Actions CI pipelines and adhering to the serverless and managed hosting architecture of the **GitHub Backup Automation System**.

## 1. Branch-First Development

> [!IMPORTANT]
> **CREATE A LOCAL BRANCH FIRST**: Always start by creating a local branch from `main`:
> ```bash
> git switch -c MishraShardendu22/main/<feature-name>
> ```
> Never make changes directly on `main`.

---

## 2. Deployment Boundaries & Hosting Targets

```text
┌───────────────────────────┐      ┌───────────────────────────┐
│     Next.js Frontend      │      │    Python Observatory     │
│   (Vercel App Router)     │      │   (Vercel FastAPI App)    │
└─────────────┬─────────────┘      └─────────────┬─────────────┘
              │                                  │
              └───────────────┬──────────────────┘
                              │
              ┌───────────────▼──────────────────┐
              │          Go Backend API          │
              │       (Render Web Service)       │
              └───────────────┬──────────────────┘
                              │
              ┌───────────────▼──────────────────┐
              │     PostgreSQL 16 + pgvector     │
              │          (Neon Managed)          │
              └──────────────────────────────────┘
```

> [!CAUTION]
> **STRICT ARCHITECTURE BOUNDARY**:
> Do **NOT** introduce Dockerfiles, `docker-compose.yml`, Kubernetes manifests, Helm charts, Nginx configs, Prometheus/Grafana containers, or container registries. All services are deployed directly onto Vercel and Render native runtimes.

---

## 2. GitHub Actions CI Matrix (`.github/workflows/ci.yml`)

The CI workflow triggers on every `push` and `pull_request` against `main`:

```yaml
jobs:
  backend-test:
    name: Go Backend Test & Build
    steps:
      - uses: actions/setup-go@v5
      - run: go test -v -race ./...
      - run: go build -v ./...

  observatory-test:
    name: Python Observatory Test & Lint
    steps:
      - uses: astral-sh/setup-uv@v5
      - run: uv sync
      - run: uv run python test_*.py

  frontend-test:
    name: Frontend Lint & Build
    steps:
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run build
```

---

## 3. Local CI Mirroring Runbook

To guarantee that your changes pass CI before committing:

```bash
# 1. Run the pre-commit gate (exact mirror of CI checks)
make pre-commit

# 2. Alternatively, run individual CI jobs locally:
# Go Backend:
go test -v -race ./... && go build -v ./...

# Python Observatory:
cd agentic-observatory && uv run python test_observability.py && uv run python test_openrouter_keys.py && uv run python test_agent_template.py && uv run python test_agent_suite.py

# Frontend:
cd frontend && pnpm run lint && pnpm run build
```

---

## 4. Secrets vs Centralized Configuration

* **Secrets**: Strictly defined in `.env` / Vercel & Render environment dashboards (`DATABASE_URL`, `INTERNAL_SECRET`, `OPENROUTER_API_KEY`, `JWT_SECRET`).
* **Operational Defaults**: Centralized in code (`backend/config/config.go`, `agentic-observatory/config/settings.py`, `frontend/src/config/env.ts`).
* Never hardcode secrets in CI workflow YAML or commits.
