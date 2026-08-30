---
name: git-post-merge-cleanup
description: >-
  Rules, safety constraints, and automated procedures for post-merge local Git cleanup,
  synchronizing main with GitHub, deleting stale local branches, and performing deep
  repository garbage collection (git gc, reflog expire, prune) strictly upon explicit human user request.
---

# Git Post-Merge Repository & Branch Cleanup Skill

This skill defines the official protocol and step-by-step procedures for cleaning up local development branches, pulling the latest `main` from GitHub after a Pull Request is merged, and executing deep Git repository garbage collection and maintenance.

---

## 1. Strict Permission & Trigger Boundary

> [!IMPORTANT]
> **EXPLICIT HUMAN INSTRUCTION ONLY**:
> AI agents MUST NEVER run local branch deletions, branch resets, or aggressive garbage collection automatically.
> This workflow is triggered **ONLY** when the human user explicitly instructs the agent to perform cleanup (e.g. *"clean up local branches"*, *"sync main and do git gc"*, *"I merged the PR, please clean up"*).
>
> The typical workflow is:
> 1. AI agent finishes work on a feature branch, passes `make pre-commit`, commits locally, pushes branch, and opens a PR targeting `main`.
> 2. The human user reviews and merges the Pull Request on GitHub.
> 3. The human user prompts the AI agent to perform local cleanup.
> 4. The AI agent executes the safe post-merge cleanup runbook below.

---

## 2. Core Cleanup Principles

1. **Safety-First Working Tree Verification**: Never switch branches or run destructive cleanups if there are uncommitted changes or uncommitted work in progress.
2. **Main as the Source of Truth**: Always switch to `main` and pull from `origin/main` first so that the newly merged PR code and history are fully present locally before deleting the feature branch.
3. **Preserve `main` (and Protected Branches)**: Only delete feature/task branches (such as `<github-username>/<parent-branch>/<feature>`). Never delete `main`.
4. **Remote Reference Pruning**: Prune stale remote tracking branches (`git fetch --prune origin`) to keep the remote tracking tree clean.
5. **Deep Garbage Collection**: Prune unreachable reflog entries (`git reflog expire --expire=now --all`) and optimize the local object store (`git gc --prune=now --aggressive`) to keep the `.git` directory small, fast, and healthy.
6. **Zero Stale Branches**: After cleanup, only `main` remains as the active local branch.

---

## 3. Step-by-Step Cleanup Runbook

When the human user requests post-merge cleanup, execute these exact steps in sequence:

### Step 1: Verify Working Directory State
Ensure there are no unstaged modifications or stash conflicts:
```bash
git status
```
If dirty, stop and check if there are uncommitted files that need to be preserved.

### Step 2: Switch to `main` and Pull Latest Upstream
Switch to the primary release branch and pull the merged changes from GitHub:
```bash
git switch main
git pull origin main
```

### Step 3: Prune Remote Tracking Branches
Synchronize and remove remote branch references that were deleted on GitHub after PR merge:
```bash
git fetch --prune origin
```

### Step 4: Identify & Delete Local Feature Branches
List all local branches to inspect what needs to be removed:
```bash
git branch
```
Delete all local feature branches (e.g. `MishraShardendu22/main/<feature>`):
```bash
# Safe delete merged branches:
git branch -d <branch-name>

# If GitHub used Squash & Merge or Rebase & Merge (which changes commit hashes):
git branch -D <branch-name>
```

Or delete all local branches except `main` in one command:
```bash
git branch | grep -v "^\* main$" | grep -v "^  main$" | xargs -r git branch -D
```

### Step 5: Expire Reflogs & Run Aggressive Garbage Collection
Clean up dangling commits, unreachable objects, and optimize packfiles:
```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Step 6: Verify Final Repository State
Verify that only `main` remains and the working tree is clean:
```bash
git branch
git status
```

---

## 4. Automated CLI & Scripting Targets

To make cleanup and maintenance instantaneous, safe, and deterministic, use the dedicated scripts and Makefile targets:

```bash
# 1. Safe Local Sync & Merged Branch Cleanup
./scripts/git-sync-and-cleanup.sh --dry-run   # Preview branches to delete
./scripts/git-sync-and-cleanup.sh --force     # Synchronize main and delete merged branches
make git-sync-clean                           # Run local sync cleaner via Makefile

# 2. Deep Git Repository Maintenance & Garbage Collection
./scripts/git-maintenance.sh                  # Standard garbage collection and repack
./scripts/git-maintenance.sh --aggressive     # Aggressive compression (maximum space savings)
make git-gc                                   # Standard GC via Makefile
make git-maintain                             # Aggressive GC via Makefile

# 3. Automated Weekly Local Maintenance Setup
./scripts/git-maintenance.sh --install-cron   # Install weekly cron job (Sundays at 02:00 AM)
./scripts/git-maintenance.sh --status         # Check automated maintenance schedule and logs
make git-maintain-install                     # Install weekly maintenance cron via Makefile
make git-maintain-status                      # Inspect maintenance schedule status
```

---

## 5. Automated Remote Branch Cleanup on PR Merge

Remote feature branch deletion is fully automated via GitHub Actions:
* **Workflow**: [`.github/workflows/pr-branch-cleanup.yml`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.github/workflows/pr-branch-cleanup.yml)
* **Trigger**: Triggers automatically on `pull_request: [closed]` when `merged == true`.
* **Action**: Deletes the remote feature branch on GitHub, preventing stale remote reference buildup.

---

## 6. Summary Matrix for AI Agents & Humans

| Trigger Event | Automated / Allowed Action | Command(s) |
| :--- | :--- | :--- |
| **PR Merged on GitHub** | **Automated (GitHub Actions)** | `.github/workflows/pr-branch-cleanup.yml` deletes remote branch |
| **Local Stale Branch Cleanup** | **YES (On Demand / Scripted)** | `make git-sync-clean` or `./scripts/git-sync-and-cleanup.sh --force` |
| **Local Weekly Git GC & Optimization** | **Automated (Cron / On Demand)** | `make git-maintain-install` or `./scripts/git-maintenance.sh` |
| **Full Sync, Clean & GC** | **YES (Post-Merge)** | `make git-clean` (`./scripts/git-sync-and-cleanup.sh --force --gc`) |
| **Unmerged Local Work Present** | Stop & Warn User | Preserved automatically unless `--force` is specified |

