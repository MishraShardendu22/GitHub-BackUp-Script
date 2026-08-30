#!/usr/bin/env bash
# ==============================================================================
# GitHub Backup Automation System — Local Git Sync & Merged Branch Cleaner
# ==============================================================================
# Synchronizes local main branch with origin, prunes stale remote tracking refs,
# and safely deletes local feature branches that have been merged and deleted remotely.
# ==============================================================================

set -euo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
RED="\033[31m"
CYAN="\033[36m"
DIM="\033[2m"
RESET="\033[0m"

log_info()    { printf "%b[INFO]%b %s\n" "${BLUE}" "${RESET}" "$*"; }
log_success() { printf "%b[PASS]%b %s\n" "${GREEN}" "${RESET}" "$*"; }
log_warn()    { printf "%b[WARN]%b %s\n" "${YELLOW}" "${RESET}" "$*"; }
log_error()   { printf "%b[ERR]%b  %s\n" "${RED}" "${RESET}" "$*" >&2; }
log_step()    { printf "\n%b▶ %s%b\n" "${BOLD}${CYAN}" "$*" "${RESET}"; }

DRY_RUN=false
FORCE=false
SWITCH_MAIN=true
RUN_GC=false

show_help() {
    cat <<EOH
Usage: $(basename "$0") [OPTIONS]

Synchronizes local repository with origin/main and cleans up merged branches.

Options:
  -n, --dry-run       Preview branches to be deleted without making any changes
  -f, --force         Force delete branches even if Squash/Rebase merge was used
      --no-switch     Do not automatically switch to 'main' branch
      --gc            Run deep garbage collection after cleaning up
  -h, --help          Show this help message and exit

Examples:
  ./scripts/git-sync-and-cleanup.sh --dry-run
  ./scripts/git-sync-and-cleanup.sh --force
  ./scripts/git-sync-and-cleanup.sh --force --gc
EOH
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        --no-switch)
            SWITCH_MAIN=false
            shift
            ;;
        --gc)
            RUN_GC=true
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

printf "%b======================================================================%b\n" "${BOLD}" "${RESET}"
printf "%b  GitHub Backup System — Local Merged Branch & Stale Ref Cleaner      %b\n" "${BOLD}" "${RESET}"
printf "%b======================================================================%b\n" "${BOLD}" "${RESET}"

if [ "${DRY_RUN}" = true ]; then
    log_warn "DRY-RUN MODE ENABLED: No branches or references will be modified or deleted."
fi

# Step 1: Prune remote references
log_step "Synchronizing with Remote Repository & Pruning Stale Tracking References"
if git remote get-url origin >/dev/null 2>&1; then
    if [ "${DRY_RUN}" = true ]; then
        log_info "Would run: git fetch --prune origin"
    else
        git fetch --prune origin || log_warn "Could not fetch from origin (offline or network unavailable)."
        log_success "Remote tracking references pruned."
    fi
else
    log_info "No remote 'origin' configured. Skipping remote fetch/prune."
fi


# Step 2: Switch to main and pull latest changes if requested
CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"
log_info "Currently active branch: ${BOLD}${CURRENT_BRANCH}${RESET}"

if [ "${SWITCH_MAIN}" = true ] && [ "${CURRENT_BRANCH}" != "main" ]; then
    log_step "Switching to 'main' Branch and Pulling Latest Merged Commits"
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warn "Working directory has unstaged modifications. Skipping branch switch to prevent conflict."
    else
        if [ "${DRY_RUN}" = true ]; then
            log_info "Would switch to 'main' and pull latest changes from origin/main."
        else
            git switch main
            git pull origin main
            CURRENT_BRANCH="main"
            log_success "'main' synchronized with origin/main."
        fi
    fi
elif [ "${CURRENT_BRANCH}" = "main" ]; then
    log_step "Pulling Latest Updates on 'main'"
    if [ "${DRY_RUN}" = true ]; then
        log_info "Would run: git pull origin main"
    else
        git pull origin main || log_warn "Could not fast-forward main (may be offline or already up to date)."
    fi
fi

# Step 3: Identify gone branches (branches whose remote tracking branch no longer exists)
log_step "Detecting Merged & Stale Local Branches"

# Find branches with ': gone]' in git branch -vv output
GONE_BRANCHES=()
while IFS= read -r branch; do
    # Remove leading * or spaces
    clean_branch="$(echo "${branch}" | awk '{print $1}' | sed 's/^\*//' | xargs)"
    if [ -n "${clean_branch}" ] && [ "${clean_branch}" != "main" ] && [ "${clean_branch}" != "master" ] && [ "${clean_branch}" != "${CURRENT_BRANCH}" ]; then
        GONE_BRANCHES+=("${clean_branch}")
    fi
done < <(git branch -vv | grep ': gone]' || true)

# Also check for locally merged branches (via git branch --merged main)
while IFS= read -r branch; do
    clean_branch="$(echo "${branch}" | sed 's/^\*//' | xargs)"
    if [ -n "${clean_branch}" ] && [ "${clean_branch}" != "main" ] && [ "${clean_branch}" != "master" ] && [ "${clean_branch}" != "${CURRENT_BRANCH}" ]; then
        # Avoid duplicates
        already_added=false
        for b in "${GONE_BRANCHES[@]:-}"; do
            if [ "${b}" = "${clean_branch}" ]; then
                already_added=true
                break
            fi
        done
        if [ "${already_added}" = false ]; then
            GONE_BRANCHES+=("${clean_branch}")
        fi
    fi
done < <(git branch --merged main | grep -v "^\*" || true)

TOTAL_STALE=${#GONE_BRANCHES[@]}

if [ "${TOTAL_STALE}" -eq 0 ]; then
    log_success "No stale or merged local feature branches found. Repository is completely clean!"
else
    log_info "Found ${BOLD}${TOTAL_STALE}${RESET} stale local branch(es) ready for cleanup:"
    for b in "${GONE_BRANCHES[@]}"; do
        printf "  • %b%s%b\n" "${YELLOW}" "${b}" "${RESET}"
    done

    log_step "Deleting Stale Local Branches"
    DELETED_COUNT=0
    FAILED_COUNT=0

    for b in "${GONE_BRANCHES[@]}"; do
        if [ "${DRY_RUN}" = true ]; then
            log_info "[DRY-RUN] Would delete local branch: ${b}"
            DELETED_COUNT=$((DELETED_COUNT + 1))
        else
            # Try safe delete first (-d)
            if git branch -d "${b}" 2>/dev/null; then
                log_success "Deleted local branch: ${b}"
                DELETED_COUNT=$((DELETED_COUNT + 1))
            elif [ "${FORCE}" = true ]; then
                # If safe delete failed (e.g. PR was squash-merged), use -D
                if git branch -D "${b}" 2>/dev/null; then
                    log_success "Force-deleted squash-merged branch: ${b}"
                    DELETED_COUNT=$((DELETED_COUNT + 1))
                else
                    log_error "Failed to force delete branch: ${b}"
                    FAILED_COUNT=$((FAILED_COUNT + 1))
                fi
            else
                log_warn "Branch '${b}' was squash-merged or has unmerged commits. Use --force (-f) to delete."
                FAILED_COUNT=$((FAILED_COUNT + 1))
            fi
        fi
    done

    printf "\n%bCleanup Summary:%b %d deleted, %d skipped/failed\n" "${BOLD}" "${RESET}" "${DELETED_COUNT}" "${FAILED_COUNT}"
fi

# Step 4: Optional Garbage Collection
if [ "${RUN_GC}" = true ]; then
    log_step "Triggering Git Garbage Collection & Optimization"
    if [ -x "./scripts/git-maintenance.sh" ]; then
        ./scripts/git-maintenance.sh
    else
        git gc --auto
        log_success "Garbage collection completed."
    fi
fi

printf "\n%b✔ Local Git cleanup workflow finished successfully.%b\n\n" "${GREEN}${BOLD}" "${RESET}"
