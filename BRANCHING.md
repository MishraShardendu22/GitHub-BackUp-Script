# Git Branching Strategy & Creation Policy

This document defines the official branch lifecycle, branch-first workflow, naming conventions, and permission boundaries for all human contributors and AI agents working on the **GitHub Backup Automation System** repository.

---

## 1. Core Principles

1. **Branch-First Development**: All new features, bug fixes, performance improvements, tests, and documentation are developed directly on dedicated Git branches originating from an up-to-date base branch (`main`).
2. **Strict No-Worktree Rule**: Git worktrees must **NO LONGER** be used for normal development tasks. Contributors and AI agents must work within the primary clone by switching branches using standard Git tooling (`git switch -c`).
3. **Structured Type-Prefixed Naming**: Branch names use standard functional prefixes (`<type>/<short-description>`) to categorize changes cleanly.
4. **All Pull Requests Target `main`**: `main` is the sole production release and integration branch. All PRs target `main`.
5. **Agent Safety Boundaries**:
   * AI agents are permitted to create, switch, and inspect local branches.
   * **STRICT RULE**: AI agents MUST NEVER run `git push` or create remote branches automatically. Pushing and opening PRs is permitted ONLY upon explicit human request.
   * **STRICT RULE**: AI agents MUST NEVER force-push (`--force`) or delete remote branches.

---

## 2. Branch Hierarchy & Structure

```text
main (Production / Stable Release Line)
│
├── feature/postgres-failover      (New capability / enhancement)
├── fix/auth-token-refresh         (Bug fix / error resolution)
├── refactor/logging-pipeline      (Code simplification / cleanup)
├── perf/vector-indexing-speed     (Performance optimization)
├── test/worker-failure-suite      (Test suite additions)
├── docs/api-telemetry-guide       (Documentation update)
├── ci/precommit-fastpath          (CI/CD and automation updates)
└── hotfix/security-middleware     (Urgent production patch)
```

---

## 3. Canonical Branch Naming Convention

All development branches MUST follow this format:

```text
<type>/<short-description>
```

### Allowed Types

| Prefix | Purpose | Example |
| :--- | :--- | :--- |
| `feature/` | New features, enhancements, or user-facing capabilities | `feature/worker-database-sync` |
| `fix/` | Bug fixes, error handling corrections, or regression fixes | `fix/db-connection-leak` |
| `refactor/` | Code refactoring without behavioral changes | `refactor/branch-first-workflow` |
| `docs/` | Documentation additions, guides, sitemaps, and changelogs | `docs/streaming-architecture` |
| `chore/` | Routine maintenance, dependency updates, and config tweaks | `chore/upgrade-biome` |
| `perf/` | Performance optimizations, caching, and database query tuning | `perf/vector-search-early-exit` |
| `test/` | Test creation, test fixtures, and mock expansion | `test/agent-failover-suite` |
| `ci/` | CI/CD workflows, GitHub Actions, and pre-commit hooks | `ci/precommit-selective-gate` |
| `hotfix/` | Critical, time-sensitive fixes applied directly to production | `hotfix/cors-header-patch` |

### Branch Naming Rules
* **Lowercase**: All characters must be lowercase (e.g. `feature/rate-limiter`, not `feature/RateLimiter`).
* **Kebab-Case**: Separate words with single hyphens (`-`).
* **Concise & Descriptive**: 2–4 descriptive words indicating the specific change.
* **No Timestamps or Random Hashes**: Avoid adding dates, timestamps, or arbitrary IDs unless uniqueness strictly requires it.

---

## 4. The Canonical Development Workflow

```text
┌─────────────────────────────────────────────────────────────┐
1. Base Update:       git fetch origin && git checkout main && git pull
2. Branch Creation:   git switch -c <type>/<short-description>
3. Implementation:    Develop code, write tests, update documentation
4. Local Validation:  make pre-commit (Formatting, Linters, Tests, Builds)
5. Local Commit:      git commit -s -S -m "<type>(<scope>): <description>"
6. Remote Push:       git push -u origin <type>/<short-description> (on request)
7. Pull Request:      gh pr create --base main (on request)
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Step-by-Step Runbooks

### For Human Contributors
```bash
# 1. Ensure main branch is clean and up to date
git checkout main
git pull origin main

# 2. Create and switch to your feature/fix branch
git switch -c feature/my-new-feature

# 3. Implement changes, validate, and commit
make pre-commit
git add .
git commit -s -S -m "feat(worker): add new repository sync mechanism"

# 4. Push and open PR
git push -u origin feature/my-new-feature
gh pr create --base main --head feature/my-new-feature --title "feat(worker): add new repository sync mechanism" --body "..."
```

### For AI Agents
```bash
# 1. Verify current branch state (do NOT spawn worktrees)
git status
git branch -a

# 2. Update base and branch off main
git switch main
git pull origin main
git switch -c <type>/<short-description>

# 3. Develop directly on the branch, run pre-commit gate, and commit locally
make pre-commit
git add <modified-files>
git commit -s -S -m "<type>(<scope>): <clear message>"

# 4. Stop and notify human developer (push/PR only when explicitly instructed)
```

---

## 6. Agent Permissions Summary

| Action | Allowed for AI Agent? | Notes |
| :--- | :--- | :--- |
| **Create Local Branch** | **YES** | Follows `<type>/<short-description>` |
| **Switch Local Branch** | **YES** | Uses `git switch` or `git checkout` |
| **Create Git Worktree** | **STRICTLY NO** | Prohibited unless explicitly requested by user |
| **Create Local Commit** | **YES** | Mandatory `-s` (sign-off) and `-S` (GPG sign) |
| **Push to Remote (`git push`)** | **ON EXPLICIT USER REQUEST ONLY** | Never push automatically |
| **Create Pull Request** | **ON EXPLICIT USER REQUEST ONLY** | Must target `main` only via `gh pr create` |
| **Force Push (`--force`)** | **STRICTLY NO** | Prohibited |
| **Delete Remote Branch** | **STRICTLY NO** | Prohibited |

