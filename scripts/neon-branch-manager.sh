#!/usr/bin/env bash
# ==============================================================================
# GitHub Backup Automation System — Neon Branch & Environment Manager
# ==============================================================================
# Automates Neon database branching for development, staging, and production.
# Preserves production data integrity while enabling isolated testing.
# ==============================================================================

set -euo pipefail

DEFAULT_PROJECT_ID="polished-glitter-60196673"
PROJECT_ID="${NEON_PROJECT_ID:-$DEFAULT_PROJECT_ID}"
DEFAULT_PARENT="production"

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

if ! command_exists neonctl; then
    echo "Error: neonctl CLI is not installed."
    echo "Install via: npm install -g neonctl"
    exit 1
fi

usage() {
    cat << USAGE_EOF
Usage: $0 <command> [options]

Commands:
  list                      List all database branches in the project
  create <name> [parent]    Create a new branch (default parent: production)
  cs <branch_name>          Output SSL connection string for a branch
  sync-staging              Create/reset the staging branch cloned from production
  sync-dev                  Create/reset the development branch cloned from production
  delete <branch_name>      Delete a non-production branch safely
  generate-env <branch>     Generate an environment file (.env.<branch>) with DATABASE_URL

Examples:
  $0 list
  $0 create staging production
  $0 cs staging
  $0 sync-staging
  $0 generate-env staging
USAGE_EOF
    exit 1
}

CMD="${1:-}"

case "${CMD}" in
    list)
        echo "Listing Neon branches for project ${PROJECT_ID}..."
        neonctl branches list --project-id "${PROJECT_ID}" --output table
        ;;
    
    create)
        BRANCH_NAME="${2:-}"
        PARENT="${3:-$DEFAULT_PARENT}"
        if [ -z "${BRANCH_NAME}" ]; then
            echo "Error: branch name required. Usage: $0 create <branch_name> [parent]"
            exit 1
        fi
        echo "Creating branch '${BRANCH_NAME}' from parent '${PARENT}'..."
        neonctl branches create --project-id "${PROJECT_ID}" --name "${BRANCH_NAME}" --parent "${PARENT}" --output json
        echo "Branch '${BRANCH_NAME}' created successfully."
        ;;

    cs|connection-string)
        BRANCH_NAME="${2:-$DEFAULT_PARENT}"
        neonctl connection-string "${BRANCH_NAME}" --project-id "${PROJECT_ID}" --ssl require
        ;;

    sync-staging)
        echo "Synchronizing 'staging' branch from '${DEFAULT_PARENT}'..."
        # Check if staging branch exists
        EXISTS=$(neonctl branches list --project-id "${PROJECT_ID}" --output json | grep -w '"name": "staging"' || true)
        if [ -n "${EXISTS}" ]; then
            echo "Staging branch already exists. Fetching connection string..."
        else
            echo "Creating staging branch from ${DEFAULT_PARENT}..."
            neonctl branches create --project-id "${PROJECT_ID}" --name "staging" --parent "${DEFAULT_PARENT}" --output json
        fi
        CS=$(neonctl connection-string "staging" --project-id "${PROJECT_ID}" --ssl require)
        echo "Staging branch ready: ${CS}"
        ;;

    sync-dev)
        echo "Synchronizing 'development' branch from '${DEFAULT_PARENT}'..."
        EXISTS=$(neonctl branches list --project-id "${PROJECT_ID}" --output json | grep -w '"name": "development"' || true)
        if [ -n "${EXISTS}" ]; then
            echo "Development branch already exists. Fetching connection string..."
        else
            echo "Creating development branch from ${DEFAULT_PARENT}..."
            neonctl branches create --project-id "${PROJECT_ID}" --name "development" --parent "${DEFAULT_PARENT}" --output json
        fi
        CS=$(neonctl connection-string "development" --project-id "${PROJECT_ID}" --ssl require)
        echo "Development branch ready: ${CS}"
        ;;

    delete)
        BRANCH_NAME="${2:-}"
        if [ -z "${BRANCH_NAME}" ]; then
            echo "Error: branch name required. Usage: $0 delete <branch_name>"
            exit 1
        fi
        if [ "${BRANCH_NAME}" = "production" ] || [ "${BRANCH_NAME}" = "main" ]; then
            echo "Error: Refusing to delete protected production branch '${BRANCH_NAME}'."
            exit 1
        fi
        echo "Deleting branch '${BRANCH_NAME}'..."
        neonctl branches delete "${BRANCH_NAME}" --project-id "${PROJECT_ID}"
        echo "Branch '${BRANCH_NAME}' deleted successfully."
        ;;

    generate-env)
        BRANCH_NAME="${2:-}"
        if [ -z "${BRANCH_NAME}" ]; then
            echo "Error: branch name required. Usage: $0 generate-env <branch_name>"
            exit 1
        fi
        TARGET_FILE=".env.${BRANCH_NAME}"
        echo "Generating ${TARGET_FILE}..."
        CS=$(neonctl connection-string "${BRANCH_NAME}" --project-id "${PROJECT_ID}" --ssl require)
        cat > "${TARGET_FILE}" << ENV_EOF
# Auto-generated Neon Environment for branch: ${BRANCH_NAME}
# Generated on: $(date -u)
DATABASE_URL=${CS}
POSTGRES_URL=${CS}
NEON_PROJECT_ID=${PROJECT_ID}
NEON_BRANCH_NAME=${BRANCH_NAME}
ENV_EOF
        echo "Saved to ${TARGET_FILE}"
        ;;

    *)
        usage
        ;;
esac
