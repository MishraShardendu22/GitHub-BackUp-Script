#!/usr/bin/env bash
# ==============================================================================
# GitHub Backup Automation System — Git Hooks Installer
# ==============================================================================
# Sets the local Git hooks path to .githooks and ensures correct permissions.
# ==============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "${REPO_ROOT}"

echo "Installing Git pre-commit & pre-push hooks for GitHub Backup Automation System..."

# Ensure .githooks directory exists
if [ ! -d ".githooks" ]; then
    echo "Error: .githooks directory not found at ${REPO_ROOT}/.githooks"
    exit 1
fi

# Make hook scripts executable
chmod +x .githooks/* 2>/dev/null || true
chmod +x scripts/*.sh 2>/dev/null || true

# Configure git to use .githooks directory
git config core.hooksPath .githooks

echo "Git hooks directory configured to: $(git config core.hooksPath)"
echo "Pre-commit and Pre-push hooks are active and executable."
echo ""
echo "To run validation manually anytime: make pre-commit"

