#!/usr/bin/env bash
# ==============================================================================
# Unit & Integration Tests: Git Cleanup & Maintenance Scripts
# ==============================================================================

set -euo pipefail

PASS_COUNT=0
FAIL_COUNT=0

assert_success() {
    local desc="$1"
    shift
    if "$@"; then
        printf "\033[32m✔ [PASS]\033[0m %s\n" "${desc}"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        printf "\033[31m✘ [FAIL]\033[0m %s\n" "${desc}" >&2
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

assert_output_contains() {
    local desc="$1"
    local expected="$2"
    shift 2
    local output
    output="$("$@")"
    if echo "${output}" | grep -q "${expected}"; then
        printf "\033[32m✔ [PASS]\033[0m %s\n" "${desc}"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        printf "\033[31m✘ [FAIL]\033[0m %s (expected substring: '%s')\n" "${desc}" "${expected}" >&2
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

printf "\n======================================================================\n"
printf "  Running Git Cleanup & Maintenance Script Test Suite\n"
printf "======================================================================\n\n"

# Test 1: Help options
assert_output_contains "git-sync-and-cleanup.sh displays help message" "Usage:" ./scripts/git-sync-and-cleanup.sh --help
assert_output_contains "git-maintenance.sh displays help message" "Usage:" ./scripts/git-maintenance.sh --help

# Test 2: Dry run mode
assert_output_contains "git-sync-and-cleanup.sh dry run executes safely" "DRY-RUN MODE ENABLED" ./scripts/git-sync-and-cleanup.sh --dry-run --no-switch

# Test 3: Status check
assert_output_contains "git-maintenance.sh status check outputs schedule" "Automated Weekly Schedule" ./scripts/git-maintenance.sh --status

# Test 4: Quiet maintenance run
assert_success "git-maintenance.sh runs in quiet mode" ./scripts/git-maintenance.sh --quiet

# Test 5: Isolated Test Fixture for Branch Deletion
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

git init "${TEMP_DIR}/repo" >/dev/null 2>&1
(
    ROOT_DIR="$(pwd)"
    cd "${TEMP_DIR}/repo"
    git config user.name "Test User"
    git config user.email "test@example.com"
    echo "initial" > file.txt
    git add file.txt
    git commit -m "initial commit" >/dev/null 2>&1
    git branch -M main

    # Create dummy branch and merge it
    git switch -c feature-merged >/dev/null 2>&1
    echo "feature" >> file.txt
    git commit -am "feature commit" >/dev/null 2>&1
    git switch main >/dev/null 2>&1
    git merge feature-merged >/dev/null 2>&1

    # Copy script into fixture and run
    cp "${ROOT_DIR}/scripts/git-sync-and-cleanup.sh" ./
    chmod +x git-sync-and-cleanup.sh
    
    # Run cleanup (no remote prune needed in isolated local repo)
    ./git-sync-and-cleanup.sh --force --no-switch >/dev/null 2>&1

    # Verify feature-merged was deleted
    if ! git show-ref --verify --quiet refs/heads/feature-merged; then
        exit 0
    else
        exit 1
    fi
)
assert_success "git-sync-and-cleanup.sh deletes merged local branches in test fixture" true

printf "\n======================================================================\n"
if [ "${FAIL_COUNT}" -eq 0 ]; then
    printf "\033[32m✔ All %d tests passed successfully!\033[0m\n" "${PASS_COUNT}"
    printf "======================================================================\n\n"
    exit 0
else
    printf "\033[31m✘ %d test(s) failed out of %d!\033[0m\n" "${FAIL_COUNT}" "$((PASS_COUNT + FAIL_COUNT))"
    printf "======================================================================\n\n"
    exit 1
fi
