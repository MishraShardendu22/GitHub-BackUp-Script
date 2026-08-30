#!/usr/bin/env bash
# ==============================================================================
# Unit & Integration Tests: Jules Autonomous AI Engineering Review Loop
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
printf "  Running Jules Autonomous AI Engineering Review Loop Test Suite\n"
printf "======================================================================\n\n"

# Test 1: Help and dry-run CLI flags
assert_output_contains "jules-review-loop.sh displays usage options" "Usage:" ./scripts/jules-review-loop.sh --help
assert_output_contains "jules-review-loop.sh evaluates 38 dimensions in dry-run" "Evaluating 38 Architectural & Production Dimensions" ./scripts/jules-review-loop.sh --dry-run
assert_output_contains "jules-review-loop.sh outputs quality score" "Quality score:" ./scripts/jules-review-loop.sh --dry-run

# Test 2: Staff-grade PR description generator
assert_output_contains "generate-final-pr outputs executive summary" "Executive Summary & Design Rationale" ./scripts/jules-review-loop.sh --generate-final-pr
assert_output_contains "generate-final-pr includes 38-dimension audit table" "38-Dimension Principal Staff Review Audit" ./scripts/jules-review-loop.sh --generate-final-pr
assert_output_contains "generate-final-pr includes Tech Lead signoff box" "Technical Lead Final Review & Merge Approval" ./scripts/jules-review-loop.sh --generate-final-pr

# Test 3: Agent Skills existence
assert_success "jules-ai-engineering-workflow skill exists" test -s .agents/skills/jules-ai-engineering-workflow/SKILL.md
assert_success "cli-tooling-guide skill exists" test -s .agents/skills/cli-tooling-guide/SKILL.md

# Test 4: GitHub Actions Workflow YAML Validation
validate_yaml() {
    python3 -c "
import sys, yaml
for path in sys.argv[1:]:
    with open(path, 'r') as f:
        yaml.safe_load(f)
" "$@"
}

assert_success "jules-ai-review-loop workflow has valid YAML syntax" validate_yaml .github/workflows/jules-ai-review-loop.yml

# Test 5: Docker/container file detection check exists in review script
assert_output_contains "review script contains Docker P0 check" "P0 Architecture" bash -c "grep -o 'P0 Architecture' scripts/jules-review-loop.sh"
assert_output_contains "review script checks for docker-compose" "docker-compose" bash -c "grep -o 'docker-compose' scripts/jules-review-loop.sh"
assert_output_contains "review script checks for Dockerfile pattern" "Dockerfile" bash -c "grep -o 'Dockerfile' scripts/jules-review-loop.sh"
assert_output_contains "review script applies status/blocked on failure" "status/blocked" bash -c "grep -o 'status/blocked' scripts/jules-review-loop.sh"
assert_output_contains "review script removes stale approved labels on block" "remove-label" bash -c "grep -o 'remove-label' scripts/jules-review-loop.sh"

# Test 6: Architecture boundary display uses dynamic color logic
assert_output_contains "review script uses dynamic architecture display" "arch_status" bash -c "grep -o 'arch_status' scripts/jules-review-loop.sh"

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
