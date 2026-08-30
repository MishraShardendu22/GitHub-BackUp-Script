---
name: cli-tooling-guide
description: >-
  Comprehensive guide to authenticated CLI tooling (GitHub CLI `gh`, Vercel CLI, Neon CLI `neonctl`, Docker CLI, uv, pnpm).
  Provides command patterns, authentication checks, recovery instructions, and agent best practices.
---

# Authenticated CLI Tooling & Automation Guide

This skill documents all CLI tools configured, authenticated, and available in this environment. AI agents and developers should prefer these authenticated CLI interfaces over manual web dashboards.

---

## 1. Tooling Matrix & Authentication Overview

| Tool | CLI Binary | Auth Check Command | Primary Usage in System |
|---|---|---|---|
| **GitHub CLI** | `gh` | `gh auth status` | Pull requests, issues, repo management, branch inspection, Actions monitoring |
| **Vercel CLI** | `vercel` | `vercel whoami` | Frontend (`frontend/`) and Observatory deployments, preview environments, DNS/domains |
| **Neon CLI** | `neonctl` | `neonctl me` | Database branching, connection strings, migrations, staging environments |
| **Docker CLI** | `docker` | `docker info` | Container builds, local multi-service composition (`docker compose`), image tags |
| **Python Package Manager** | `uv` | `uv --version` | Ultra-fast virtualenv management, dependency syncing (`uv sync`), type checking |
| **Node.js Package Manager** | `pnpm` | `pnpm --version` | Frontend dependencies, Next.js build, Biome formatting/linting |
| **Go Toolchain** | `go` | `go version` | Backend API compilation, backup worker CLI execution, test suites |

---

## 2. Command Reference by Tool

### A. GitHub CLI (`gh`)
* **Create Pull Request**:
  ```bash
  gh pr create --base main --head <branch-name> --title "<title>" --body "<body-markdown>"
  ```
* **View PR Status**:
  ```bash
  gh pr status
  gh pr view <pr-number>
  ```
* **Check GitHub Actions CI/CD Runs**:
  ```bash
  gh run list --limit 10
  gh run watch <run-id>
  ```

### B. Neon CLI (`neonctl`)
* **List Projects**:
  ```bash
  neonctl projects list --output json
  ```
* **List Branches**:
  ```bash
  neonctl branches list --project-id <project-id> --output json
  ```
* **Create Branch (e.g. staging or dev)**:
  ```bash
  neonctl branches create --project-id <project-id> --name <branch-name> --parent production --output json
  ```
* **Get Connection String**:
  ```bash
  neonctl connection-string <branch-name> --project-id <project-id> --ssl require
  ```
* **Delete Stale Branch**:
  ```bash
  neonctl branches delete <branch-id-or-name> --project-id <project-id>
  ```

### C. Vercel CLI (`vercel`)
* **Deploy Frontend (Preview / Branch)**:
  ```bash
  cd frontend && vercel deploy
  ```
* **Deploy Frontend to Production**:
  ```bash
  cd frontend && vercel deploy --prod
  ```
* **Inspect Deployments**:
  ```bash
  vercel ls
  ```

### D. Docker CLI (`docker` & `docker compose`)
* **Build Stack**:
  ```bash
  docker compose build
  ```
* **Start Local Stack in Background**:
  ```bash
  docker compose up -d
  ```
* **Run Backup Worker CLI**:
  ```bash
  docker compose run --rm backup-worker
  ```
* **Build Multi-Arch / Cached Images with Buildx**:
  ```bash
  docker buildx build -t <username>/<repo>:<tag> -f <Dockerfile> .
  ```

---

## 3. Recovery & Re-Authentication Runbook

If any CLI tool reports authentication expiration or failure, do NOT attempt unreliable programmatic bypasses. Alert the human developer with the exact command to re-authenticate:

1. **GitHub CLI**:
   - Error: `gh: authentication expired` or `gh: not logged in`
   - Fix: Run `gh auth login`
2. **Vercel CLI**:
   - Error: `Error: Not logged in`
   - Fix: Run `vercel login`
3. **Neon CLI**:
   - Error: `neonctl: Unauthorized` or `auth token expired`
   - Fix: Run `neonctl auth`
4. **Docker Hub**:
   - Error: `unauthorized: access token has expired`
   - Fix: Run `docker login`

---

## 4. Recommended CLI Tools for Productivity

The following optional tools further streamline production operations:
* **`render-cli` / Render API**: Triggering instant manual deploy webhooks from terminal.
* **`trivy`**: Local vulnerability scanner for container images before pushing to registries.
* **`gitleaks`**: Fast static analysis for detecting uncommitted secrets and API keys.
