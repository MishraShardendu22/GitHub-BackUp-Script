#!/usr/bin/env bash
# ==============================================================================
# GitHub Backup Automation System — Automated Local Git Maintenance & GC
# ==============================================================================
# Performs periodic or scheduled repository garbage collection, dangling blob
# cleanup, packfile repack, and reflog expiration without disturbing active refs.
# Supports automated weekly cron installation.
# ==============================================================================

set -euo pipefail

# Text formatting
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

AGGRESSIVE=false
QUIET=false
INSTALL_CRON=false
UNINSTALL_CRON=false
CHECK_STATUS=false

show_help() {
    cat <<EOH
Usage: $(basename "$0") [OPTIONS]

Performs automated local Git maintenance, garbage collection, and blob optimization.

Options:
  -a, --aggressive      Run deep aggressive packfile optimization (slower, maximum space savings)
  -q, --quiet           Quiet mode (suitable for cron / background execution)
      --install-cron    Install a weekly automated cron job (runs every Sunday at 02:00)
      --uninstall-cron  Remove the automated weekly cron job
      --status          Check the automated cron job status and recent maintenance logs
  -h, --help            Show this help message and exit

Examples:
  ./scripts/git-maintenance.sh
  ./scripts/git-maintenance.sh --aggressive
  ./scripts/git-maintenance.sh --install-cron
  ./scripts/git-maintenance.sh --status
EOH
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -a|--aggressive)
            AGGRESSIVE=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        --install-cron)
            INSTALL_CRON=true
            shift
            ;;
        --uninstall-cron)
            UNINSTALL_CRON=true
            shift
            ;;
        --status)
            CHECK_STATUS=true
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

# Ensure we are inside a Git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log_error "Not inside a valid Git repository."
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"
GIT_DIR="$(git rev-parse --git-dir)"
LOG_FILE="${GIT_DIR}/git-maintenance.log"

# Cron installation handler
CRON_TAG="# github-backup-automation-system-git-maintenance"
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
CRON_SCHEDULE="0 2 * * 0 ${SCRIPT_PATH} --quiet >> ${LOG_FILE} 2>&1 ${CRON_TAG}"

if [ "${INSTALL_CRON}" = true ]; then
    log_step "Installing Weekly Automated Git Maintenance Cron Job"
    
    # Check if crontab is available
    if ! command -v crontab >/dev/null 2>&1; then
        log_error "crontab command not found on system."
        exit 1
    fi

    # Read existing crontab (ignoring exit code if empty)
    CURRENT_CRON="$(crontab -l 2>/dev/null || true)"

    # Remove existing entry if present
    CLEAN_CRON="$(echo "${CURRENT_CRON}" | grep -v "${CRON_TAG}" || true)"

    # Append new scheduled entry
    printf "%s\n%s\n" "${CLEAN_CRON}" "${CRON_SCHEDULE}" | sed '/^$/d' | crontab -

    log_success "Weekly automated Git maintenance scheduled (Every Sunday at 02:00 AM)."
    log_info "Maintenance log destination: ${LOG_FILE}"
    exit 0
fi

if [ "${UNINSTALL_CRON}" = true ]; then
    log_step "Uninstalling Automated Git Maintenance Cron Job"
    if command -v crontab >/dev/null 2>&1; then
        CURRENT_CRON="$(crontab -l 2>/dev/null || true)"
        CLEAN_CRON="$(echo "${CURRENT_CRON}" | grep -v "${CRON_TAG}" || true)"
        if [ -n "${CLEAN_CRON}" ]; then
            echo "${CLEAN_CRON}" | crontab -
        else
            crontab -r 2>/dev/null || true
        fi
        log_success "Weekly Git maintenance cron job removed."
    else
        log_warn "crontab command not available."
    fi
    exit 0
fi

if [ "${CHECK_STATUS}" = true ]; then
    log_step "Git Maintenance Status & Log Inspection"
    
    CRON_ACTIVE=false
    if command -v crontab >/dev/null 2>&1; then
        if crontab -l 2>/dev/null | grep -q "${CRON_TAG}"; then
            CRON_ACTIVE=true
        fi
    fi

    if [ "${CRON_ACTIVE}" = true ]; then
        log_success "Automated Weekly Schedule: ACTIVE (Every Sunday at 02:00 AM)"
    else
        log_info "Automated Weekly Schedule: NOT INSTALLED (Run with --install-cron to enable)"
    fi

    if [ -f "${LOG_FILE}" ]; then
        log_info "Recent Maintenance Log (${LOG_FILE}):"
        printf "\n%s\n" "$(tail -n 20 "${LOG_FILE}")"
    else
        log_info "No previous maintenance logs found at ${LOG_FILE}."
    fi
    exit 0
fi

# Main Maintenance Execution
if [ "${QUIET}" = false ]; then
    printf "%b======================================================================%b\n" "${BOLD}" "${RESET}"
    printf "%b  GitHub Backup System — Local Git Repository Maintenance & GC        %b\n" "${BOLD}" "${RESET}"
    printf "%b======================================================================%b\n" "${BOLD}" "${RESET}"
fi

# Helper to calculate size in KB
get_dir_size_kb() {
    local target="$1"
    if [ -d "${target}" ]; then
        du -sk "${target}" 2>/dev/null | awk '{print $1}' || echo "0"
    else
        echo "0"
    fi
}

SIZE_BEFORE=$(get_dir_size_kb "${GIT_DIR}/objects")

if [ "${QUIET}" = false ]; then
    log_info "Git objects directory size before maintenance: ${BOLD}${SIZE_BEFORE} KB${RESET}"
fi

# Step 1: Expire unreachable reflogs (preserve 14 days of reachable history for safety)
if [ "${QUIET}" = false ]; then
    log_step "Expiring Dangling Reflogs & Unreachable History"
fi
git reflog expire --expire=14.days --expire-unreachable=now --all

# Step 2: Prune loose objects that are unreferenced
if [ "${QUIET}" = false ]; then
    log_step "Pruning Dangling Objects"
fi
git prune --expire=now

# Step 3: Run Git Garbage Collection & Repack
if [ "${QUIET}" = false ]; then
    log_step "Running Packfile Optimization and Garbage Collection"
fi

if [ "${AGGRESSIVE}" = true ]; then
    git gc --prune=now --aggressive
else
    git gc --prune=now
fi

SIZE_AFTER=$(get_dir_size_kb "${GIT_DIR}/objects")
SAVED_KB=$((SIZE_BEFORE - SIZE_AFTER))
if [ "${SAVED_KB}" -lt 0 ]; then
    SAVED_KB=0
fi

TIMESTAMP="$(date -u +"%Y-%m-%d %H:%M:%SZ")"

# Record to maintenance log
printf "[%s] Git Maintenance: Initial=%dKB, Final=%dKB, Reclaimed=%dKB, Mode=%s\n" \
    "${TIMESTAMP}" "${SIZE_BEFORE}" "${SIZE_AFTER}" "${SAVED_KB}" "$([ "${AGGRESSIVE}" = true ] && echo "aggressive" || echo "standard")" >> "${LOG_FILE}"

if [ "${QUIET}" = false ]; then
    printf "\n%bMaintenance Results:%b\n" "${BOLD}" "${RESET}"
    printf "  • Size Before : %d KB\n" "${SIZE_BEFORE}"
    printf "  • Size After  : %d KB\n" "${SIZE_AFTER}"
    printf "  • Reclaimed   : %b%d KB%b\n" "${GREEN}" "${SAVED_KB}" "${RESET}"
    printf "\n%b✔ Local Git repository maintenance completed successfully.%b\n\n" "${GREEN}${BOLD}" "${RESET}"
fi
