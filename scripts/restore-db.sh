#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

# Verify checksum if sha256 file exists
if [ -f "${BACKUP_FILE}.sha256" ]; then
  echo "Verifying SHA256 checksum..."
  (cd "$(dirname "${BACKUP_FILE}")" && sha256sum -c "$(basename "${BACKUP_FILE}.sha256")")
fi

# Auto-source service .env if present
for env_file in "backend/.env" "backup-worker/.env" ".env" "../backend/.env" "../backup-worker/.env" "../.env"; do
  if [ -f "${env_file}" ]; then
    set -a
    source "${env_file}"
    set +a
    break
  fi
done

DB_CONN="${DATABASE_URL:-${POSTGRES_URL:-postgresql://postgres:postgres@localhost:5432/github_backup}}"
export DATABASE_URL="${DB_CONN}"
export POSTGRES_URL="${DB_CONN}"

echo "WARNING: This will restore database from '${BACKUP_FILE}'."
read -p "Are you sure you want to proceed? [y/N]: " -r CONFIRM
if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
  echo "Restore operation cancelled."
  exit 0
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Restoring database from '${BACKUP_FILE}'..."

if ! command -v psql &> /dev/null; then
  echo "Error: psql command not found on host. Please install postgresql-client tools."
  exit 1
fi

gunzip -c "${BACKUP_FILE}" | psql "${DB_CONN}"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Database restore completed successfully!"
