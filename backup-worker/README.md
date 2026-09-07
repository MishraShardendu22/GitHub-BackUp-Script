# Backup Observatory — Backup Worker Engine

The Backup Worker is an autonomous Go CLI engine that discovers repositories across personal accounts and GitHub organizations, verifies remote commit hashes via `git ls-remote` for incremental updates, performs parallel cloning and `.tar.gz` archiving, commits archives to the central backup Git repository, and streams telemetry and logs to PostgreSQL.

---

## Tech Stack

- **Language**: Go 1.24+
- **State Store**: SQLite (fast local hash caching in `app.db`)
- **Telemetry DB**: PostgreSQL (`pgxpool`)
- **Logging**: Uber Zap (`go.uber.org/zap`)
- **VCS & Compression**: Git CLI & tar (`gzip`)

---

## Getting Started

### Prerequisites

- Go toolchain installed (1.24+)
- Git CLI configured with SSH key access to target GitHub accounts
- Optional: PostgreSQL connection string (`DATABASE_URL`) for centralized telemetry

### Configuration

Create or update `.env` in the `backup-worker/` directory with the following environment variables:

```env
# Required for discovery & rate limits:
GITHUB_TOKEN_PERSONAL=ghp_your_personal_token
GITHUB_TOKEN_PRIVATE=ghp_your_private_repo_token

# Repository & Organization Targets:
PROJECT_ACCOUNT=YourUsername
ORG_ACCOUNT=YourOrgName
BACKUP_REPO_PATH=git@github.com:YourUsername/Your-Backup-Repo.git

# Telemetry Database (Optional):
DATABASE_URL=postgres://user:password@localhost:5432/dbname?sslmode=disable

# Local File Overrides (Optional):
DB_PATH=./app.db
REPOS_PATH=_Repos
```

---

## Running the Backup Worker

From the repository root:

```bash
# Run via root Makefile target
make backup
```

Or run directly within the service directory:

```bash
cd backup-worker
go run main.go
```

---

## Service Architecture & Workflow

```
1. Discover Repositories (Public, Org, Private API endpoints)
   ↓
2. Check Remote HEAD Hashes (Parallel git ls-remote vs SQLite app.db)
   ↓
3. Process Deleted Repositories (Prune removed repos from backup state)
   ↓
4. Batch Clone & Archive (5 workers in parallel: shallow clone -> tar.gz -> strip .git)
   ↓
5. Serial Atomic Git Commits & Push to Central Backup Repo
   ↓
6. Update Local SQLite Cache (app.db) & Stream Run Analytics to PostgreSQL
```

---

## Directory Structure

- `main.go`: Worker entrypoint and execution lifecycle coordinator.
- `config/`: Environment configuration and GitHub API URL builders.
- `controller/`: REST client (`resty`) for GitHub repository discovery.
- `database/`: SQLite connection pool, schema initialization, and hash caching.
- `model/`: Configuration, URL, and repository data structures.
- `service/`: Backup execution workflow, worker pools, and deletion synchronizer.
  - `collect/`: Snapshot analytics collectors for repository sizes, blobs, and Git metadata.
  - `helper/`: Command retry execution wrappers and Git CLI helpers.
  - `monitor/`: PostgreSQL telemetry and structured execution logging.
- `util/`: Environment variable extractors, error handlers, and Zap logger.
- `_Repos/`: Working directory for active Git clones and `.tar.gz` archives (gitignored).
- `app.db`: SQLite database caching repository commit hashes across runs.
