# Git Branching Strategy & Creation Policy

This document defines the official branch lifecycle, branch-first workflow, naming conventions, and permission boundaries for all human contributors and AI agents working on the **GitHub Backup Automation System** repository.

---

## 1. Core Principles

1. **Branch-First Development**: All new features, bug fixes, performance improvements, tests, and documentation are developed directly on dedicated Git branches originating from an up-to-date base branch (`main`).
2. **Strict No-Worktree Rule**: Git worktrees must **NO LONGER** be used for normal development tasks. Contributors and AI agents must work within the primary clone by switching branches using standard Git tooling (`git switch -c`).
3. **Structured Hierarchical Naming**: Branch names use the standard format `<github-username>/<parent-branch>/<feature>` to clearly declare ownership, lineage, and purpose.
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
├── MishraShardendu22/main/database-auto-sync    (Feature: SQLite auto pull/push sync)
├── MishraShardendu22/main/precommit-workflow     (Feature: Intelligent pre-commit gate)
├── MishraShardendu22/main/branch-first-migration (Refactor: Worktree deprecation)
├── MishraShardendu22/main/fix-auth-token-refresh (Fix: Token refresh bug)
└── MishraShardendu22/main/perf-vector-indexing   (Perf: Embedding optimization)
```

---

## 3. Canonical Branch Naming Convention

All development branches MUST follow this format:

```text
<github-username>/<parent-branch>/<feature>
```

### Components Breakdown

* **`<github-username>`**: The GitHub username of the author (e.g. `MishraShardendu22`).
* **`<parent-branch>`**: The base branch name (typically `main`).
* **`<feature>`**: Concise, kebab-case description of the feature, fix, or refactor (e.g. `database-auto-sync`, `precommit-workflow`, `branch-first-migration`).

### Branch Naming Rules
* **Lowercase**: All characters must be lowercase (e.g. `MishraShardendu22/main/database-sync`, not `MishraShardendu22/main/DatabaseSync`).
* **Kebab-Case Feature Description**: Separate words with single hyphens (`-`).
* **Concise & Descriptive**: 2–4 descriptive words indicating the specific change.
* **No Timestamps or Random Hashes**: Avoid adding dates, timestamps, or arbitrary IDs unless uniqueness strictly requires it.

---

## 4. The Canonical Development Workflow

```text
┌─────────────────────────────────────────────────────────────┐
1. Base Update:       git fetch origin && git checkout main && git pull
2. Branch Creation:   git switch -c <github-username>/<parent-branch>/<feature>
3. Implementation:    Develop code, write tests, update documentation
4. Local Validation:  make pre-commit (Formatting, Linters, Tests, Builds)
5. Local Commit:      git commit -s -S -m "<type>(<scope>): <description>"
6. Remote Push:       git push -u origin <github-username>/<parent-branch>/<feature> (on request)
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

# 2. Create and switch to your feature branch
git switch -c MishraShardendu22/main/my-new-feature

# 3. Implement changes, validate, and commit
make pre-commit
git add .
git commit -s -S -m "feat(worker): add new repository sync mechanism"

# 4. Push and open PR
git push -u origin MishraShardendu22/main/my-new-feature
gh pr create --base main --head MishraShardendu22/main/my-new-feature --title "feat(worker): add new repository sync mechanism" --body "..."
```

### For AI Agents
```bash
# 1. Verify current branch state (do NOT spawn worktrees)
git status
git branch -a

# 2. Update base and branch off main
git switch main
git pull origin main
git switch -c <github-username>/<parent-branch>/<feature>

# 3. Develop directly on the branch, run pre-commit gate, and commit locally
make pre-commit
git add <modified-files>
git commit -s -S -m "<type>(<scope>): <clear message>"

# 4. Stop and notify human developer (push/PR only when explicitly instructed)
```

---

## 6. Managing Multiple PRs & Merge Conflicts

When working with multiple features or sequential pull requests, merge conflicts can arise if multiple PRs touch overlapping files (such as `CHANGELOG.md` or shared packages).

### Conflict Prevention & Resolution Strategy
1. **Consolidated PRs for Interdependent Tasks**: Group tightly coupled changes into a single comprehensive PR to avoid inter-PR merge conflicts.
2. **Rebasing on Updated `main`**: If another PR merges into `main` before yours, synchronize your branch locally:
   ```bash
   # Fetch latest main
   git fetch origin
   git rebase origin/main
   # Or: git merge origin/main

   # Re-run validations
   make pre-commit

   # Force-with-lease update your feature branch
   git push --force-with-lease origin <github-username>/<parent-branch>/<feature>
   ```

---

## 7. Agent Permissions Summary

| Action | Allowed for AI Agent? | Notes |
| :--- | :--- | :--- |
| **Create Local Branch** | **YES** | Follows `<github-username>/<parent-branch>/<feature>` |
| **Switch Local Branch** | **YES** | Uses `git switch` or `git checkout` |
| **Create Git Worktree** | **STRICTLY NO** | Prohibited unless explicitly requested by user |
| **Create Local Commit** | **YES** | Mandatory `-s` (sign-off) and `-S` (GPG sign) |
| **Push to Remote (`git push`)** | **ON EXPLICIT USER REQUEST ONLY** | Never push automatically |
| **Create Pull Request** | **ON EXPLICIT USER REQUEST ONLY** | Must target `main` only via `gh pr create` |
| **Force Push (`--force`)** | **STRICTLY NO** | Prohibited |
| **Delete Remote Branch** | **STRICTLY NO** | Prohibited |

