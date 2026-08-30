# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Docker-First Architecture Migration** — Complete containerisation of all four services:
  - `backend/Dockerfile`: Multi-stage Go build (`golang:1.25-alpine` → `distroless/static-debian12:nonroot`); CGO=0 static binary with zero OS attack surface.
  - `agentic-observatory/Dockerfile`: Multi-stage Python 3.14 build (`python:3.14-slim`); uv-managed `.venv` in builder stage copied to minimal runtime.
  - `frontend/Dockerfile`: Three-stage Next.js 16 standalone build (`node:20-alpine`); minimal runner with only the standalone bundle and static assets.
  - `backup-worker/Dockerfile`: Multi-stage Go CLI build (`golang:1.25-alpine` with CGO + git/ssh → `alpine:3.22` runtime); volume mounts for `_Repos/`, `app.db`, and `~/.ssh`.
  - `docker-compose.yml`: Full-stack local orchestration for backend (8080), observatory (8000), and frontend (3000). Backup worker gated behind `worker` profile.
  - `.dockerignore` files (×5): Build context exclusions for each service directory.
  - `make docker-up`, `docker-down`, `docker-build`, `docker-logs`, `docker-backup`, `docker-shell-backend`, `docker-shell-observatory`, `docker-clean` Makefile targets.
  - `docker-build` GitHub Actions CI job: verifies all four Dockerfiles build cleanly on every PR using Docker Buildx with GitHub Actions layer caching.
  - PHASE 4 in `.githooks/pre-commit`: Docker Compose build validation triggered when `Dockerfile*` or `docker-compose*.yml` files are staged; gracefully skipped if Docker daemon is unavailable.
  - `frontend/next.config.ts`: `output: 'standalone'` for minimal Docker image via standalone Next.js output.
  - `.env.example` (root): Consolidated environment variable reference for the entire Docker Compose stack.
  - `.agents/skills/docker-workflow/SKILL.md`: New dedicated agent skill covering Dockerfile patterns, Docker Compose workflow, volume mount conventions, env var management, CI integration, and production deployment targets.
- **Documentation updated** for Docker-first architecture:
  - `AGENTS.md`: Removed no-Docker rule; rewrote Section 1 as Docker-first mandate; added `make docker-build` to Verification Checklist.
  - `docs/ARCHITECTURE.md`: Replaced "No Docker / Containers in Production" constraint with Container Architecture section; updated topology diagram to show containerised services.
  - `README.md`: Rewrote Local Development Workflow to lead with Docker Compose; updated Deployment section to describe Docker image builds per service.
  - `WORKFLOW.md`: Added `make docker-build` to Stage 3 Validation.
  - `.agents/skills/ci-cd-workflow/SKILL.md`: Removed anti-Docker prohibition; added Docker image build as standard CI/CD pipeline step.
  - `.agents/skills/codebase-simplification-guide/SKILL.md`: Replaced "No Unwanted Infrastructure" Docker prohibition with Docker-first principle.
  - `.agents/skills/github-backup-architecture/SKILL.md`: Updated topology and service descriptions to reflect containerised deployment.


  - Shifted root CLI backup engine into dedicated `backup-worker/` directory for full microservice separation (`frontend/`, `backend/`, `agentic-observatory/`, `backup-worker/`).
  - Added root `make backup` developer target to execute the backup worker CLI seamlessly.
  - Relocated and encapsulated `backup-worker/_Repos/` working tree and `backup-worker/app.db` local state.
  - Updated all Go package import paths to `github.com/MishraShardendu22/github-backup/backup-worker/...`.
- Canonical Branch-First Development Workflow ([`BRANCHING.md`](BRANCHING.md)):
  - Established canonical hierarchical branch naming standard `<github-username>/<parent-branch>/<feature>`.
  - Deprecated Git worktrees across the project in favor of direct branch switching (`git switch -c`).
  - Enforced that all development branches originate from `main` and all Pull Requests target `main`.
- Automated SQLite Database Cross-OS Synchronization:
  - Added pre-run pull (`PullRootRepo()`) to fetch the latest `app.db` before running backups.
  - Seamless, always-on synchronization ensuring cross-OS database consistency without requiring environment configuration.
- Repository Workflow & Safety Guidelines ([`WORKFLOW.md`](WORKFLOW.md)):
  - Established end-to-end engineering pipeline: `branch -> dev -> validation -> local commit -> human review -> push -> merge`.
  - Enforced strict **Human-In-The-Loop Push Boundary**: AI agents are permitted to commit locally but are strictly forbidden from executing `git push` without explicit user instruction.
- Specialized Agent Skills Suite (`.agents/skills/` and `agents/`):
  - `git-branch-management`: Canonical branch-first workflow, hierarchical naming (`<github-username>/<parent-branch>/<feature>`), base branch resolution, and safe branch navigation.
  - `git-commit-workflow`: Conventional Commits, validation checklist, and human review boundaries.
  - `test-creation-and-execution`: Test creation patterns and runbooks across Go, Python, and TypeScript.
  - `ci-cd-workflow`: GitHub Actions matrix, Render/Vercel boundaries, and containerless architecture.
  - `code-quality-and-validation`: Formatting, linting, and type checking standards.
  - `precommit-workflow-management`: Operations, bypasses, and staged file filtering for `.githooks/pre-commit`.
  - `repository-maintenance`: Idempotent SQL migrations, pgvector embedding lifecycle, and backup/restore runbooks.
  - `pull-request-management`: Explicit user-triggered PR workflow ensuring all PRs target `main` only.
  - `git-post-merge-cleanup`: Step-by-step procedures for post-merge local Git cleanup, syncing `main` from GitHub, deleting stale local branches, and executing `git gc` and `reflog expire` on explicit user request.
- `make git-clean` developer and agent target:
  - Automates switching to `main`, pulling `origin/main`, pruning remote tracking refs, deleting local feature branches, and running aggressive Git garbage collection (`git reflog expire`, `git gc --prune=now --aggressive`).
- Intelligent Git Pre-Commit Hook Workflow (`.githooks/pre-commit`):
  - Automatically inspects staged files and selectively triggers targeted validations across Go Backend/Worker, Python Agentic Observatory, and Next.js Frontend.
  - Multi-tier validation pipeline: code formatting (`gofmt`, Biome), static analysis & type checking (`go vet`, `pyright`, `tsc`), test suites, and production artifact builds.
  - Fail-fast execution with timing diagnostics, colorized logging, and remediation advice.
  - Documentation-only fast-path bypassing heavy builds on non-code changes.
  - Developer automation targets in `Makefile`: `make hooks-install`, `make pre-commit`, `make format`, `make typecheck`.
  - Comprehensive documentation in `docs/PRECOMMIT_WORKFLOW.md`.
- Initial release of Backup Observatory (GitHub Backup)
- Worker (CLI) for cloning, archiving, and pushing GitHub repositories
- Backend (Dashboard/API) with PostgreSQL-backed metrics, run history, and live logs
- WebSocket endpoint for real-time log streaming
- Dedicated Analytics section with historical charts, metrics, and storage summary
- Paginated table views for run history and Git repository snapshots
- Frontend dashboard built with Next.js, Tailwind CSS, and Recharts
- SSH multiplexing configuration for multiple GitHub accounts
- SQLite metadata tracking for repo hash deduplication and failure logging
- Parallel repository processing with `parallelHashCheck` and `parallelCloneAndArchive`
- Automatic large-file detection (archives >95MB are skipped)
- AI assistant layer (agentic-observatory) with OpenRouter integration and streaming chat
- Email report delivery via SMTP from the AI agent
- JWT-authenticated chat API with session management
- Semantic search over backup metadata using pgvector embeddings
- PostgreSQL Schema Normalization & Migration `000005`:
  - Dropped redundant `ai_chat_sessions.metadata` and created dedicated `ai_session_metadata` entity (`id UUID PK`, `session_id UUID FK UNIQUE`, `metadata JSONB`)
  - Normalized `analytics_snapshots` by removing duplicate surrogate sequence `id` and establishing `run_id` as primary key
  - Normalized `backup_runs` error data into dedicated `backup_run_errors` table (`id`, `run_id FK UNIQUE`, `error_message`) and dropped nullable `error_message` column from `backup_runs`
  - Normalized `backup_results` error data into dedicated `backup_result_errors` table (`id`, `result_id FK UNIQUE`, `error_message`) and dropped nullable `error_message` column from `backup_results`
  - Normalized `backup_fixes` by extracting optional commit hashes into dedicated `backup_fix_commits` table (`id`, `fix_id FK UNIQUE`, `commit_hash`) and dropping `commit_hash` from `backup_fixes`
  - Normalized `ai_tool_calls` by extracting non-empty parameters and failures into dedicated `ai_tool_call_args` and `ai_tool_call_errors` tables, dropping nullable `args` and `error` columns from `ai_tool_calls`
  - Normalized `embedding_chunks` metadata into dedicated `embedding_chunk_metadata` table (`id`, `chunk_id FK UNIQUE`, `metadata JSONB`) and dropped `metadata` column from `embedding_chunks`
  - Normalized `embedding_jobs` error data into dedicated `embedding_job_errors` table (`id`, `job_id FK UNIQUE`, `error_message`) and dropped nullable `error_message` column from `embedding_jobs`
  - Normalized `investigations` error data into dedicated `investigation_errors` table (`id`, `investigation_id FK UNIQUE`, `error`) and dropped nullable `error` column from `investigations`
  - Enforced generation lifecycle timestamps (`completed_at` set and `retired_at` cleared to `NULL` on `ACTIVE` generations)
  - Partial indexing on failure states across `backup_results`, `backup_run_errors`, `backup_result_errors`, `embedding_job_errors`, `investigation_errors`, `ai_tool_calls`
  - Partial indexing on commit hashes for `backup_results` and `backup_fix_commits`
  - Transactional blue-green embedding generation promotion (`BUILDING` -> `READY` -> `ACTIVE` -> `RETIRED`)
  - Safe cascade pruning of obsolete embedding generations and stale jobs without removing source records