# Architecture

This document gives a concise overview of components, responsibilities and data flow.

Components:
- Worker (CLI): `main.go` -> `service.RunBackupFlow`
  - Responsibilities: discover repositories, decide which changed, clone/archive, commit & push to `_Repos`, update SQLite metadata and log failures.

- Backend (Dashboard/API): `backend/main.go`
  - Responsibilities: connect to PostgreSQL, apply migrations, provide REST endpoints for runs/metrics/logs, and a WebSocket endpoint for live logs.

Key packages and responsibilities:
- `controller/` — GitHub API client wrappers (uses `resty`) to fetch paginated lists of repositories.
- `service/` — high-level orchestration. Important files:
  - `backup.service.go` — orchestrates the full flow including DB initialization and repository discovery.
  - `process.service.go` — heavy-lifting: parallel hash checking, parallel clone+archive, serial commit+push, DB upserts and cleanup.
- `service/helper` — shell interactions for `git`, `tar` and related filesystem operations. These commands are executed via `os/exec` and must run on a POSIX shell.
- `database/` — SQLite persistence for repo metadata and failure logs. Contains SQL statements for schema and operations.
- `backend/db` — Postgres connection and migration SQL used by dashboard endpoints.
- `backend/handlers` — HTTP handlers that map DB queries to API responses consumed by the frontend UI.

Data flow (simplified):
1. Worker loads config and opens SQLite database.
2. Worker queries GitHub (controller) to build a list of repo full names.
3. Worker compares remote HEAD hashes (via `git ls-remote`) with the previously stored hash in SQLite.
4. For changed repos: shallow clone -> remove `.git` -> tar.gz -> git add/commit/push (in `_Repos`).
5. Worker updates SQLite with latest commit hash and logs any failure in `failed_logs`.
6. Backend connects to PostgreSQL (separate DB) and exposes historical runs, metrics and live logs which the UI renders.

Concurrency model:
- Hash checking: concurrent up to `hashCheckWorkers`.
- Cloning/archiving: limited concurrent workers `cloneWorkers`.
- Commit & push: performed serially per repository to avoid git conflicts inside the `_Repos` repo.

Operational constraints:
- The backup remote must permit pushing from the machine running the worker (SSH key or HTTPS auth).
- Worker uses shell tools and relies on available disk and network I/O. Consider running on a machine with sufficient storage for temporary archives.
