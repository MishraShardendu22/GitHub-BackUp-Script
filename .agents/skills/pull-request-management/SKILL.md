---
name: pull-request-management
description: >-
  Rules and runbooks for creating and managing GitHub Pull Requests when explicitly requested by the user.
  Enforces that all PRs must target 'main' only and are never created automatically.
---

# Pull Request Management & Creation Skill

This skill guides AI agents and contributors on how to create, format, and manage Pull Requests (PRs) in the **GitHub Backup Automation System** repository.

---

## 1. Core Pull Request Rules

> [!IMPORTANT]
> **EXPLICIT USER REQUEST REQUIRED**:
> * AI agents MUST **NEVER** create Pull Requests automatically or as a default background action.
> * Agents are only authorized to push branches and open Pull Requests when **specifically and explicitly instructed by the user** (e.g. *"create a PR to main"*).

> [!CAUTION]
> **TARGET BRANCH IS ALWAYS `main` ONLY**:
> * All Pull Requests in this repository MUST target **`main`**.
> * Never open Pull Requests against `dev`, feature branches, or temporary staging branches. `main` is the sole integration branch.

---

## 2. Pre-PR Validation Checklist

Before opening any Pull Request, the agent/developer MUST ensure:

1. **Local Commits Clean**: All intended changes are committed with Conventional Commit messages (`git status` is clean).
2. **Pre-Commit Gate Passed**: The full pre-commit pipeline has executed and passed without errors:
   ```bash
   make pre-commit
   ```
3. **Branch Pushed to Remote**: The local branch is pushed to origin:
   ```bash
   git push -u origin <branch-name>
   ```

---

## 3. Pull Request Creation Runbook

### Using GitHub CLI (`gh`)

When requested by the user to create a PR:

1. Extract authentication token if needed:
   ```bash
   export GH_TOKEN=$(grep GITHUB_TOKEN_PERSONAL .env | cut -d'"' -f2)
   ```
2. Push the local branch to the remote repository:
   ```bash
   git push -u origin <branch-name>
   ```
3. Create the PR targeting `main`:
   ```bash
   gh pr create \
     --base main \
     --head <branch-name> \
     --title "<type>(<scope>): <concise title>" \
     --body "$(cat << 'EOF'
   ## Summary of Changes
   * <Bullet points describing what was implemented or fixed>

   ## Testing & Verification
   * [x] `make pre-commit` executed and passed all validations
   * [x] Unit, integration, and AI agent test suites passed (`make test`)
   * [x] Static type checking passed (Pyright & TypeScript)
   * [x] Production builds succeeded (Go binaries & Next.js Turbopack)

   ## Documentation
   * [x] Relevant documentation updated in `docs/`, `README.md`, and `CHANGELOG.md`
   EOF
   )"
   ```

---

## 4. Post-Creation Confirmation

Once the PR is opened:
* Output the generated PR URL (e.g. `https://github.com/MishraShardendu22/github-backup-automation-system/pull/123`).
* Summarize the base branch (`main`), head branch, and included commit range.
