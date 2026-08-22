---
name: git-branch-management
description: >-
  Rules and procedures for creating, naming, structuring, and navigating Git branches
  in the repository for both human contributors and AI agents.
---

# Git Branch Management Skill

This skill guides AI agents and human contributors on how to create, name, structure, and navigate Git branches in the **GitHub Backup Automation System** repository.

---

## 1. Core Branching Principles

1. **Branch-First Development**: All changes (features, fixes, refactoring, tests, docs) are developed directly on Git branches created from `main`.
2. **Strict No-Worktree Rule**: AI agents and contributors must **NOT** create or use Git worktrees for standard development tasks. All work occurs in the primary repository clone via branch switching (`git switch -c`).
3. **Structured Type-Prefixed Naming**: Branch names follow the standard format `<type>/<short-description>`.
4. **All Pull Requests Target `main`**: `main` is the sole production integration branch. Never open PRs against `dev` or temporary feature branches.
5. **Agent Safety Boundaries**:
   * Agents may create or switch between local branches directly.
   * **STRICT RULE**: Agents MUST NOT push branches to a remote repository automatically. Pushing and opening PRs is permitted ONLY upon explicit human request.
   * **STRICT RULE**: Agents MUST NEVER force-push (`git push --force`) or delete remote branches.

---

## 2. Branch Naming Convention

All development branches MUST follow the standard structure:

```text
<type>/<short-description>
```

### Allowed Types

| Prefix | Purpose | Example |
| :--- | :--- | :--- |
| `feature/` | New capabilities, enhancements, or additions | `feature/worker-database-sync` |
| `fix/` | Bug fixes and defect resolutions | `fix/sqlite-wal-checkpoint` |
| `refactor/` | Code refactoring without behavior change | `refactor/branch-first-workflow` |
| `docs/` | Documentation additions and updates | `docs/streaming-architecture` |
| `chore/` | Routine tasks, configs, dependencies | `chore/upgrade-biome` |
| `perf/` | Performance optimizations | `perf/vector-search-early-exit` |
| `test/` | Test suite creation and expansion | `test/agent-failover-suite` |
| `ci/` | CI/CD workflows and pre-commit hooks | `ci/precommit-selective-gate` |
| `hotfix/` | Critical production fixes | `hotfix/cors-header-patch` |

### Rules
* **Lowercase**: All characters lowercase.
* **Kebab-Case**: Hyphen-separated words.
* **Concise**: 2–4 descriptive words.
* **No Timestamps/Hashes**: Avoid timestamps or random suffixes unless required for uniqueness.

---

## 3. Canonical Branch Workflow Runbook

### For Human Contributors
```bash
# 1. Update main branch
git checkout main
git pull origin main

# 2. Create and switch to new branch
git switch -c feature/my-feature

# 3. Develop, validate, and commit
make pre-commit
git add .
git commit -s -S -m "feat(worker): add new capability"

# 4. Push and open PR
git push -u origin feature/my-feature
gh pr create --base main --head feature/my-feature --title "feat(worker): add new capability" --body "..."
```

### For AI Agents
1. Inspect repository and branch status (do NOT spawn worktrees):
   ```bash
   git status
   git branch -a
   ```
2. Switch to `main` and pull latest changes:
   ```bash
   git switch main
   git pull origin main
   ```
3. Create local branch:
   ```bash
   git switch -c <type>/<short-description>
   ```
4. Develop directly on that branch, run `make pre-commit`, and commit locally with `-s` and `-S`.
5. When explicitly requested by the user, push to remote and open a PR targeting `main`.

---

## 4. Merging & Local Branch Cleanup

1. Once a Pull Request is merged into `main`, delete the local branch:
   ```bash
   git switch main
   git pull origin main
   git branch -d <branch-name>
   ```
2. **Preserving History**: Never delete or rename existing branches without inspecting commit history.
