---
name: precommit-workflow-management
description: >-
  Rules, architecture, and runbooks for configuring, updating, and operating the intelligent Git pre-commit workflow.
---

# Pre-Commit Workflow Management Skill

This skill explains how to maintain, configure, and execute the intelligent pre-commit hook workflow in the **GitHub Backup Automation System** monorepo.

---

## 1. Pre-Commit Architecture

The pre-commit workflow lives in [`.githooks/pre-commit`](file:///home/ms22/.gemini/antigravity/worktrees/github-backup-automation-system/generate_precommit_workflow/.githooks/pre-commit) and is tracked directly in version control.

```text
Staged Changes Detected (git diff --cached)
  │
  ├── Only Go files changed ───────► Run Go formatting, vet, tests, build (~1-2s)
  ├── Only Python files changed ───► Run Pyright typecheck, agent test suite (~3-4s)
  ├── Only Frontend files changed ─► Run Biome lint, Next.js build (~10-12s)
  ├── Only Documentation changed ──► Fast-path bypass (<0.2s)
  └── Global / Config / Manual ────► Full monorepo validation gate (~20s)
```

---

## 2. Key Features

1. **Selective Staged-File Execution**: Avoids unnecessary work by only running checks relevant to the files staged for the commit.
2. **Fast-Path for Documentation**: Commits containing only markdown (`*.md`), text (`*.txt`), or asset files skip expensive build and test pipelines.
3. **Subshell Directory Isolation**: Every check runs in a subshell `(cd "${REPO_ROOT}" && ...)` to prevent current working directory drift.
4. **Fail-Fast with Remediation**: Aborts immediately on failure and outputs exact commands needed to fix the problem.
5. **Zero External Runtime Dependencies**: Implemented in portable POSIX bash, requiring no npm wrapper packages (like Husky) at the repository root.

---

## 3. Operations & Maintenance Runbook

### Activating the Hook Locally
```bash
make hooks-install
# Or: ./scripts/install-hooks.sh
```

### Manually Running Pre-Commit Gate
```bash
make pre-commit
```

### Bypass Flags (Emergency Only)
```bash
# Skip tests for quick drafts
SKIP_TESTS=1 git commit -m "chore: draft"

# Skip builds for lightweight edits
SKIP_BUILDS=1 git commit -m "fix: comment"

# Force full validation across all subsystems
PRECOMMIT_ALL=1 git commit -m "feat: core change"
```
