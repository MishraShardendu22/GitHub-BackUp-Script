# Git Branching Strategy & Creation Policy

This document defines the official branch lifecycle, hierarchical naming convention, and permission boundaries for all human contributors and AI agents working on the **GitHub Backup Automation System** repository.

---

## 1. Core Principles

1. **Explicit Parent Lineage**: Every branch represents a purposeful line of development rooted in a designated parent/base branch (`main` or an epic feature branch).
2. **Hierarchical Logical Naming**: Branch names use `/` separators to group branches logically by owner, parent context, and feature scope.
3. **Git Branches Are Not Directories**: In Git, branch names are flat string references. The forward slash (`/`) is purely a naming and organization convention to provide readable structural hierarchy in Git tooling and terminal outputs.
4. **Agent Safety Boundaries**:
   * AI agents are permitted to create, switch, and inspect local branches.
   * **STRICT RULE**: AI agents MUST NEVER run `git push` to push branches or commits to any remote repository.
   * **STRICT RULE**: AI agents MUST NEVER force-push (`--force`) or delete remote branches.

---

## 2. Branch Hierarchy & Structure

```text
main (Production / Stable Release Line)
│
└── MishraShardendu22/dev/cleanup (Feature Epic / Refactoring Baseline)
    │
    ├── MishraShardendu22/dev/cleanup/precommit-workflow (Task: Pre-commit gate)
    ├── MishraShardendu22/dev/cleanup/testing            (Task: Test suite expansion)
    └── MishraShardendu22/dev/cleanup/ci-cd              (Task: GitHub Actions workflow)
```

### Hierarchy Descriptions
* **`main`**: The primary, production-ready branch. All code in `main` is deployable and passes all validation gates.
* **`<github-username>/<epic>`** (e.g. `MishraShardendu22/dev/cleanup`): A feature epic or milestone branch that serves as the parent/base for sub-tasks within a major initiative.
* **`<github-username>/<parent-branch>/<change>`** (e.g. `MishraShardendu22/dev/cleanup/precommit-workflow`): A task-specific branch containing atomic, focused work that targets its parent epic branch.

---

## 3. Branch Naming Convention

All development branches MUST follow this format:

```text
<github-username>/<parent-branch>/<change>
```

### Format Breakdown
* `<github-username>`: Author's GitHub username (e.g. `MishraShardendu22`).
* `<parent-branch>`: The base branch name without author prefix (e.g. `dev/cleanup` or `main`).
* `<change>`: Kebab-case description of the feature, fix, or task (e.g. `precommit-workflow`, `agent-skills`, `postgres-indexes`).

### Valid Examples
* `MishraShardendu22/dev/cleanup/precommit-workflow` (Task branching off `MishraShardendu22/dev/cleanup`)
* `MishraShardendu22/dev/cleanup/testing` (Task branching off `MishraShardendu22/dev/cleanup`)
* `MishraShardendu22/dev/cleanup/ci-cd` (Task branching off `MishraShardendu22/dev/cleanup`)
* `MishraShardendu22/main/hotfix-auth` (Emergency fix branching directly off `main`)

---

## 4. Determining the Correct Parent Branch

| Change Scope | Target Parent Branch | Example New Branch Name |
| :--- | :--- | :--- |
| **Epic Sub-Task** (part of ongoing refactor or multi-step feature) | Active Epic Branch (e.g. `MishraShardendu22/dev/cleanup`) | `MishraShardendu22/dev/cleanup/task-name` |
| **Standalone Feature** (independent of active epics) | `main` | `MishraShardendu22/main/feature-name` |
| **Production Hotfix** (critical bugfix destined directly for release) | `main` | `MishraShardendu22/main/hotfix-name` |

---

## 5. When to Create a New Branch vs Continue Existing

### Create a NEW Branch When:
* Starting a new discrete task or feature with its own logical scope.
* Introducing architectural changes or new infrastructure tooling.
* Working concurrently on a separate component without blocking the parent branch.

### Continue on an EXISTING Branch When:
* Addressing direct feedback or review comments on the active branch's task.
* Applying small, incremental fixes strictly related to the current task scope.
* Completing the immediate milestones defined for the active worktree.

---

## 6. Step-by-Step Branch Creation Runbooks

### For Human Contributors
```bash
# 1. Fetch latest changes from remote
git fetch origin

# 2. Checkout and pull the desired parent branch
git checkout MishraShardendu22/dev/cleanup
git pull origin MishraShardendu22/dev/cleanup

# 3. Create and switch to the new hierarchical branch
git switch -c MishraShardendu22/dev/cleanup/precommit-workflow
```

### For AI Agents
```bash
# 1. Inspect existing branch state and worktrees
git status
git branch -a

# 2. Verify HEAD and lineage
git log -n 1 --oneline

# 3. Create local branch (DO NOT push remotely)
git switch -c <github-username>/<parent-branch>/<change>
```

---

## 7. Merging & Integration Runbook

Once all development and tests pass the pre-commit gate:

```bash
# 1. Switch back to the parent branch
git checkout MishraShardendu22/dev/cleanup

# 2. Merge or rebase the task branch
git merge MishraShardendu22/dev/cleanup/precommit-workflow

# 3. Run full validation gate to confirm integrity
make pre-commit

# 4. Human developer performs final review and executes push:
git push origin MishraShardendu22/dev/cleanup
```

---

## 8. Agent Permissions Summary

| Action | Allowed for AI Agent? | Notes |
| :--- | :--- | :--- |
| **Create Local Branch** | **YES** | Follows `<github-username>/<parent-branch>/<change>` |
| **Switch Local Branch** | **YES** | Safe local navigation |
| **Create Local Commit** | **YES** | Must pass `make pre-commit` first |
| **Push to Remote (`git push`)** | **STRICTLY NO** | Reserved exclusively for human review |
| **Force Push (`--force`)** | **STRICTLY NO** | Prohibited |
| **Delete Remote Branch** | **STRICTLY NO** | Prohibited |
