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

1. **Clear Parent Lineage**: Every branch MUST have a clearly identified parent branch. Do not create orphan branches or branch off arbitrary commits without understanding their lineage.
2. **Hierarchical Logical Naming**: Branch names use `/` separators to indicate their organizational hierarchy (`<github-username>/<parent-branch>/<change>`). Note: `/` characters in Git branch names are for human and tool organization, not actual filesystem directories.
3. **Task-Specific & Ephemeral**: Feature and bugfix branches are short-lived lines of development meant to be merged back into their parent branch upon review.
4. **Agent Branch Boundaries**:
   * Agents may create or switch between local branches when instructed.
   * **STRICT RULE**: Agents MUST NOT push branches to a remote repository automatically. Pushing and opening PRs is permitted ONLY upon explicit human request.
   * **ALL PRS TARGET `main`**: All Pull Requests must target `main` only (never `dev` or feature branches).
   * **STRICT RULE**: Agents MUST NEVER force-push (`git push --force`) or delete remote branches.

---

## 2. Branch Naming Convention

All development branches MUST follow the standard naming structure:

```text
<github-username>/<parent-branch>/<change>
```

### Anatomy of a Branch Name
* `<github-username>`: The GitHub username of the author (e.g. `MishraShardendu22`).
* `<parent-branch>`: The immediate parent/base branch name without user prefix (e.g. `dev/cleanup` or `main`).
* `<change>`: Concise, kebab-case description of the purpose (e.g. `precommit-workflow`, `testing`, `api-security`).

### Examples
* `MishraShardendu22/dev/cleanup/precommit-workflow` (Feature branch branching off `MishraShardendu22/dev/cleanup`)
* `MishraShardendu22/dev/cleanup/testing` (Test expansion branching off `MishraShardendu22/dev/cleanup`)
* `MishraShardendu22/main/hotfix-auth` (Emergency hotfix branching directly off `main`)

---

## 3. Branch Hierarchy & Lineage Tree

```text
main (Production / Stable Release Line)
└── MishraShardendu22/dev/cleanup (Longer-lived feature / refactoring epic)
    ├── MishraShardendu22/dev/cleanup/precommit-workflow (Task: Pre-commit hook)
    ├── MishraShardendu22/dev/cleanup/testing (Task: Test suite expansion)
    └── MishraShardendu22/dev/cleanup/ci-cd (Task: GitHub Actions update)
```

### Determining the Correct Parent Branch
* If your change is part of an ongoing epic or refactoring milestone, branch off that epic branch (e.g. `MishraShardendu22/dev/cleanup`).
* If your change is a standalone feature or direct bugfix destined directly for production, branch off `main`.
* Never branch off another developer's unmerged task branch unless there is an explicit dependency.

---

## 4. Branch Creation Runbook

### For Human Contributors
```bash
# 1. Fetch latest changes and checkout the parent branch
git checkout MishraShardendu22/dev/cleanup
git pull origin MishraShardendu22/dev/cleanup

# 2. Create and switch to the new hierarchical branch
git switch -c MishraShardendu22/dev/cleanup/precommit-workflow
```

### For AI Agents
1. Before creating a branch, inspect the current branch state:
   ```bash
   git status
   git branch -a
   ```
2. Verify the active parent commit with `git log -n 1`.
3. Create the local branch without pushing to any remote:
   ```bash
   git switch -c <github-username>/<parent-branch>/<change>
   ```

---

## 5. Merging & Branch Retirement

1. **Rebase or Merge into Parent**: Once work is locally validated and passes `make pre-commit`, merge or rebase the task branch back into its parent branch.
2. **Local Cleanup**: Delete the local task branch only after its commits have been verified and integrated into the parent branch:
   ```bash
   git branch -d <branch-name>
   ```
3. **Preserving History**: Never delete or rename existing branches without inspecting their commit history and active worktrees.
