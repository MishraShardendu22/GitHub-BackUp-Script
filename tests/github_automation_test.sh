#!/usr/bin/env bash
# ==============================================================================
# Unit & Integration Tests: GitHub Automation, Templates & Label Sync
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
printf "  Running GitHub PR/Issue Automation & Label Test Suite\n"
printf "======================================================================\n\n"

# Test 1: Labels Synchronizer Script Help & Dry-Run
assert_output_contains "github-labels-sync.sh displays usage help" "Usage:" ./scripts/github-labels-sync.sh --help
assert_output_contains "github-labels-sync.sh dry run executes cleanly" "DRY-RUN MODE ENABLED" ./scripts/github-labels-sync.sh --dry-run
assert_output_contains "github-labels-sync.sh declares standard label categories" "type/feat" ./scripts/github-labels-sync.sh --dry-run

# Test 2: Templates Existence
assert_success "PULL_REQUEST_TEMPLATE.md exists and is non-empty" test -s .github/PULL_REQUEST_TEMPLATE.md
assert_success "bug_report.yml issue form exists" test -s .github/ISSUE_TEMPLATE/bug_report.yml
assert_success "feature_request.yml issue form exists" test -s .github/ISSUE_TEMPLATE/feature_request.yml
assert_success "task.yml issue form exists" test -s .github/ISSUE_TEMPLATE/task.yml
assert_success "config.yml issue config exists" test -s .github/ISSUE_TEMPLATE/config.yml

# Test 3: GitHub Workflows YAML Syntax Validation
validate_yaml() {
    python3 -c "
import sys, yaml
for path in sys.argv[1:]:
    with open(path, 'r') as f:
        yaml.safe_load(f)
" "$@"
}

assert_success "GitHub Actions workflow YAMLs are valid syntax" validate_yaml .github/workflows/*.yml
assert_success "GitHub Issue form YAMLs are valid syntax" validate_yaml .github/ISSUE_TEMPLATE/*.yml

# Test 4: Agent Skill Existence
assert_success "github-pr-issue-automation skill exists" test -s .agents/skills/github-pr-issue-automation/SKILL.md

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
