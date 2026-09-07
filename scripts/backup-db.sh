#!/usr/bin/env bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/gbm_pg_backup_${TIMESTAMP}.sql.gz"

# Auto-source .env if present
if [ -f ".env" ]; then
  set -a
  source ".env"
  set +a
elif [ -f "../.env" ]; then
  set -a
  source "../.env"
  set +a
fi

# Database Connection (DATABASE_URL preferred, fallback to POSTGRES_URL or localhost default)
DB_CONN="${DATABASE_URL:-${POSTGRES_URL:-postgresql://postgres:postgres@localhost:5432/github_backup}}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting PostgreSQL backup..."

if ! command -v pg_dump &> /dev/null; then
  echo "Error: pg_dump command not found on host. Please install postgresql-client tools."
  exit 1
fi

pg_dump "${DB_CONN}" --clean --if-exists --no-owner | gzip > "${BACKUP_FILE}"

FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
SHA256=$(sha256sum "${BACKUP_FILE}" | cut -d' ' -f1)
echo "${SHA256}  $(basename "${BACKUP_FILE}")" > "${BACKUP_FILE}.sha256"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Backup completed successfully: ${BACKUP_FILE} (Size: ${FILESIZE})"

# Prune backups older than RETENTION_DAYS
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "gbm_pg_backup_*.sql.gz*" -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Backup cycle finished."
