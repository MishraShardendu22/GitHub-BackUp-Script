---
name: ci-cd-workflow
description: >-
  Rules, architectures, and guidelines for maintaining GitHub Actions CI/CD workflows,
  Docker Hub image publishing, Render & Vercel automated deployments, and Neon database branching.
---

# CI/CD & Deployment Architecture Skill

This skill guides AI agents and contributors in maintaining GitHub Actions CI/CD pipelines, Docker Hub container publishing, and automated zero-touch deployments across Vercel and Render for the **GitHub Backup Automation System**.

## 1. Branch-First Development & Commit Cadence

> [!IMPORTANT]
> **CREATE A LOCAL BRANCH FIRST & COMMIT FREQUENTLY**:
> Always start by creating a local branch from `main`:
> ```bash
> git switch -c MishraShardendu22/main/<feature-name>
> ```
> Commit at each logical milestone (`more commits = more explanatory work`). Never commit directly on `main`.

---

## 2. Deployment Boundaries & Automated Pipeline

```text
┌───────────────────────────┐      ┌───────────────────────────┐
│     Next.js Frontend      │      │    Python Observatory     │
│  (Vercel Production Edge) │      │   (Vercel Serverless /)   │
└─────────────┬─────────────┘      └─────────────┬─────────────┘
              │                                  │
              └───────────────┬──────────────────┘
                              │
              ┌───────────────▼──────────────────┐
              │          Go Backend API          │
              │    (Render Container Service)    │
              │  (Auto-Deployed from Docker Hub) │
              └───────────────┬──────────────────┘
                              │
              ┌───────────────▼──────────────────┐
              │     PostgreSQL 16 + pgvector     │
              │    (Neon Database Branching)     │
              │  [production, staging, dev]      │
              └──────────────────────────────────┘
```


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
