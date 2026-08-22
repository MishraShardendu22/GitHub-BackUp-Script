---
name: repository-maintenance
description: >-
  Procedures for database schema integrity, idempotent migrations, backup/restore execution,
  and dependency maintenance.
---

# Repository Maintenance Skill

This skill provides procedures for maintaining database integrity, executing database backups, applying schema migrations, and managing dependencies across the **GitHub Backup Automation System**.

---

## 1. Database Schema Integrity & Migrations

> [!CAUTION]
> **CRITICAL RULE**: Never execute destructive SQL statements (`DROP TABLE`, `TRUNCATE`). Production data has historical backup logs spanning months.

### Migration Rules
* All migrations MUST be located in `backend/db/migrations/` using versioned naming `NNNNNN_<name>.up.sql` and `NNNNNN_<name>.down.sql`.
* All SQL statements MUST be idempotent:
  * `CREATE TABLE IF NOT EXISTS ...`
  * `CREATE INDEX IF NOT EXISTS ...`
  * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
* Schema migrations are orchestrated exclusively by Go backend startup (`backend/db/migrator.go`).

---

## 2. Backup & Disaster Recovery Runbook

PostgreSQL database dumps are automated with SHA-256 integrity verification:

```bash
# 1. Execute an automated database backup (stored in backups/postgres/ with 14-day retention)
make backup-db

# 2. Restore database from a backup file
make restore-db BACKUP_FILE=backups/postgres/gbm_pg_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## 3. Dependency Management

* **Go Dependencies**: Managed via `go.mod`. Update with `go get -u` and clean with `go mod tidy`.
* **Python Observatory**: Managed via `uv` in `agentic-observatory/`. Update with `uv lock --upgrade` and sync with `uv sync`.
* **Frontend Dashboard**: Managed via `pnpm` in `frontend/`. Update with `pnpm update`. Ensure native modules like `sharp` and `@biomejs/biome` remain authorized in `frontend/pnpm-workspace.yaml`.
