# Backup Observatory (GitHub Backup)

A compact Go-based system that clones, archives, and stores GitHub repositories into a single backup repo and exposes a Postgres-backed dashboard for visibility.

This repository contains two main programs:
- a worker (CLI) that runs backup flows and stores lightweight SQLite metadata (entrypoint: [main.go](main.go#L1))
- a web backend (dashboard/API) that serves metrics, run history, real-time logs and an AI assistant UI (entrypoint: [backend/main.go](backend/main.go#L1))

**Quick summary**
- Worker: Walks GitHub (org / user / personal private), deduplicates repos, checks remote HEAD hashes, clones changed repos, archives them to tar.gz, commits to a central `_Repos` git repository and pushes to a configured remote.
- Backend: Connects to PostgreSQL, runs migrations, serves a REST API and a WebSocket endpoint used by the frontend to show runs, metrics and live logs.

**Repository layout (high level)**
- `main.go` – worker entrypoint and configuration loader. See [main.go](main.go#L1).
- `backend/` – web server, handlers and websocket logic. See [backend/main.go](backend/main.go#L1) and [backend/routes/router.go](backend/routes/router.go#L1).
- `service/` – core worker logic. See [service/process.service.go](service/process.service.go#L1) and [service/backup.service.go](service/backup.service.go#L1).
- `service/helper/` – shell helpers for git, cloning, archiving and pushing. See [service/helper/git.go](service/helper/git.go#L1) and [service/helper/repo.go](service/helper/repo.go#L1).
- `controller/` – GitHub API fetch logic. See [controller/repo.controller.go](controller/repo.controller.go#L1).
- `database/` – SQLite helpers for repo hashes and logs. See [database/repo_hash.go](database/repo_hash.go#L1) and [database/schema.go](database/schema.go#L1).
- `backend/db` – PostgreSQL connection and migrations used by the dashboard. See [backend/db/postgres.go](backend/db/postgres.go#L1).
- `model/` – central struct definitions used by the worker. See [model/config.model.go](model/config.model.go#L1).

**Key behaviors and flow**
- Configuration: loaded from environment and `.env` in development via `config.LoadEnv()` and `config.LoadConfig()`; model of environment variables is in [config/config.go](config/config.go#L1).
- Worker startup: `main.go` initializes logger, loads config, connects to SQLite (`database.ConnectSQLite`) and invokes `service.RunBackupFlow`.
- RunBackupFlow: migrates/init DB, collects repositories using `controller.RepoController*`, deduplicates, prints list and calls `ProcessRepos`.
- ProcessRepos: ensures `_Repos` exists and initialized, removes deleted repos (DB vs GitHub), then:
  - Phase 1: `parallelHashCheck` (concurrent) — compute remote HEAD with `git ls-remote` to determine if repo changed (skip if unchanged and recorded in DB).
  - Phase 2: `parallelCloneAndArchive` (worker pool) — shallow clone, remove `.git`, tar.gz the repo.
  - Phase 3: For each archive: `git add`, `git commit` (skips if no changes), `git push` (serial per repo), update SQLite record (`UpsertRepo`).
- Resilience: errors during per-repo operations are recorded to the DB via `database.LogFailure` and logged.

**Environment variables**
- Worker / config (used in `config.LoadConfig`):
  - `ORG_ACCOUNT` — organization name for org repos
  - `PROJECT_ACCOUNT` — project/user for public repos
  - `MAIN_ACCOUNT` — (unused placeholder)
  - `DB_PATH` — SQLite file path (default `./app.db`)
  - `BACKUP_REPO_PATH` — remote git URL used to initialize and push `_Repos` (required to initialize)
  - `GITHUB_TOKEN_PRIVATE` — token with access to private repos (used by `RepoControllerPrivate`)
  - `GITHUB_TOKEN_PERSONAL` — personal token to increase API rate limits for public calls

- Backend (from `.env` / environment):
  - `POSTGRES_URL` — full Postgres connection string for the dashboard (required for backend)
  - `SERVER_PORT` — optional (default `8080`)

There is an example `sample.env` in the repo to guide local setup.

**How to run**
Prerequisites: Go toolchain installed, `git`, `tar` available on PATH and shell access.

- Worker (backup flow):
```
# configure .env or export env vars
go run main.go
```

- Backend (dashboard/API):
```
cd backend
# ensure POSTGRES_URL is set and Postgres is available
go run main.go
```

Notes:
- The worker uses an on-disk SQLite database by default (`DB_PATH`), while the web dashboard requires PostgreSQL for richer analytics and persistence.
- The worker modifies the `_Repos` directory and runs `git` commands there; ensure the user running the worker has appropriate permissions.

**Important files & where to look for details**
- Worker entry: [main.go](main.go#L1)
- Worker flow: [service/backup.service.go](service/backup.service.go#L1) and [service/process.service.go](service/process.service.go#L1)
- Git helpers: [service/helper/git.go](service/helper/git.go#L1)
- Repo list fetch: [controller/repo.controller.go](controller/repo.controller.go#L1)
- SQLite schema and operations: [database/schema.go](database/schema.go#L1) and [database/repo_hash.go](database/repo_hash.go#L1)
- Backend server & routes: [backend/main.go](backend/main.go#L1) and [backend/routes/router.go](backend/routes/router.go#L1)
- Backend handlers and API contract: [backend/handlers/backup.go](backend/handlers/backup.go#L1) and related handler files in the same folder.

**Security & operational considerations**
- Tokens: keep `GITHUB_TOKEN_PRIVATE` and `GITHUB_TOKEN_PERSONAL` secret; do not commit them.
- Backup repository remote: `BACKUP_REPO_PATH` should be an authenticated remote (SSH or HTTPS with token) where the backup commits are pushed.
- Large repositories: archives larger than ~95MB are skipped (configurable) to avoid hitting GitHub blob limits; see `maxGitHubBlobSize` in [service/process.service.go](service/process.service.go#L1).

**Troubleshooting**
- If worker logs show authentication or rate-limit errors, verify tokens and scopes. See [controller/repo.controller.go](controller/repo.controller.go#L1) for how responses are handled.
- If backend fails to start, verify `POSTGRES_URL` and check migration errors printed by `backend/db/postgres.go`.

**Screenshots and UI**
UI screenshots are included in the `Images/` folder. Quick references:

- Overview page: [main overview page](Images/main-overview-page.webp)
- Backups / history detail: [backup detail page](Images/backup-detail-page.webp)
- Metrics: [metrics page](Images/metrics-page.webp)
- Live logs (websocket): [live websocket logs feed](Images/live-websocket-logs-feed.webp)
- AI assistant / risk assessment: [ai results page](Images/ai-results-page.webp)
- Tailscale / tunnel & server console: [tailscale tunneling](Images/tailscale-tunneling.webp)

**Contributing**
Please follow the coding conventions already present in the repository. See `CONTRIBUTING.md` for a short guide.
