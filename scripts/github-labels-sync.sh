#!/usr/bin/env bash
# ==============================================================================
# GitHub Backup Automation System — GitHub Labels Declarative Synchronizer
# ==============================================================================
# Declares and synchronizes the standard color-coded taxonomy of GitHub labels
# across type, area, size, and status categories.
# ==============================================================================

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

log_info()    { printf "%b[INFO]%b %s\n" "${BLUE}" "${RESET}" "$*"; }
log_success() { printf "%b[PASS]%b %s\n" "${GREEN}" "${RESET}" "$*"; }
log_warn()    { printf "%b[WARN]%b %s\n" "${YELLOW}" "${RESET}" "$*"; }
log_error()   { printf "%b[ERR]%b  %s\n" "${RED}" "${RESET}" "$*" >&2; }
log_step()    { printf "\n%b▶ %s%b\n" "${BOLD}${CYAN}" "$*" "${RESET}"; }

DRY_RUN=false

show_help() {
    cat <<EOH
Usage: $(basename "$0") [OPTIONS]

Synchronizes the standardized taxonomy of GitHub labels for the repository.

Options:
  -n, --dry-run    Preview labels to be created or synchronized without executing
  -h, --help       Show this help message and exit

Examples:
  ./scripts/github-labels-sync.sh --dry-run
  ./scripts/github-labels-sync.sh
EOH
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

printf "%b======================================================================%b\n" "${BOLD}" "${RESET}"
printf "%b  GitHub Backup System — GitHub Labels Declarative Synchronizer       %b\n" "${BOLD}" "${RESET}"
printf "%b======================================================================%b\n" "${BOLD}" "${RESET}"

if [ "${DRY_RUN}" = true ]; then
    log_warn "DRY-RUN MODE ENABLED: No labels will be created or modified on GitHub."
fi

# Define labels: name|color|description
LABELS=(
    # Types
    "type/feat|0e8a16|New feature, API capability, or system extension"
    "type/fix|d73a4a|Bug fix, error resolution, or regression fix"
    "type/perf|fbca04|Performance optimization, latency reduction, caching"
    "type/refactor|1d76db|Code refactoring without behavioral changes"
    "type/docs|0075ca|Documentation, architecture guides, skills, and changelogs"
    "type/db|5319e7|Database migrations, schema evolution, and pgvector models"
    "type/ci|bfdadc|CI/CD pipelines, Dockerfiles, and deployment automation"
    "type/test|d4c5f9|Unit tests, mock servers, and AI agent test suites"
    "type/ui|e99695|Frontend components, Tailwind design, visual styling"
    
    # Areas / Subsystems
    "area/frontend|61dafb|Next.js App Router, Tailwind CSS, Biome, Turbopack"
    "area/backend|00add8|Go Fiber REST API, WebSocket hub, pgxpool"
    "area/observatory|3776ab|FastAPI, LangChain Tool-Calling RAG Agent, pgvector"
    "area/backup-worker|f34f29|Go CLI backup engine and SQLite storage"
    "area/ci-cd|2088ff|GitHub Actions workflows and build pipelines"
    "area/database|336791|Neon PostgreSQL, pgvector, and SQLite migrations"
    "area/documentation|0052cc|Agent skills, markdown specifications, and guides"
    "area/security|b60205|Authentication, secrets management, and credential vault"
    
    # PR Sizes
    "size/XS|ededed|Diff size under 50 lines"
    "size/S|c5def5|Diff size 50 to 249 lines"
    "size/M|bfdadc|Diff size 250 to 499 lines"
    "size/L|f9d0c4|Diff size 500 to 999 lines"
    "size/XL|d93f0b|Diff size 1000+ lines"
    
    # Lifecycle & Status
    "status/ready-for-review|0e8a16|Ready for code review and automated checks"
    "status/in-progress|fbca04|Work in progress; not yet ready for review"
    "status/hitl-required|b60205|Human-In-The-Loop confirmation required"
    "status/blocked|b60205|Blocked by external dependency or upstream issue"
)

log_step "Synchronizing ${#LABELS[@]} Standard Repository Labels"

CREATED_COUNT=0

for item in "${LABELS[@]}"; do
    IFS="|" read -r name color desc <<< "${item}"
    
    if [ "${DRY_RUN}" = true ]; then
        log_info "[DRY-RUN] Would sync label: ${BOLD}${name}${RESET} (Color: #${color}, Desc: ${desc})"
        CREATED_COUNT=$((CREATED_COUNT + 1))
    else
        if command -v gh >/dev/null 2>&1; then
            if gh label create "${name}" --color "${color}" --description "${desc}" --force 2>/dev/null; then
                log_success "Synchronized label: ${BOLD}${name}${RESET}"
                CREATED_COUNT=$((CREATED_COUNT + 1))
            else
                log_warn "Could not create/update label: ${name} (may require permissions or network)"
            fi
        else
            log_warn "GitHub CLI (gh) not installed. Cannot synchronize label '${name}'."
        fi
    fi
done

printf "\n%b✔ Label synchronization completed (%d labels processed).%b\n\n" "${GREEN}${BOLD}" "${CREATED_COUNT}" "${RESET}"
