---
name: git-commit-workflow
description: >-
  Rules, message formats, and strict permission boundaries for creating local Git commits.
  Enforces the rule that AI agents commit locally but never push to remotes.
---

# Git Commit Workflow & Permission Boundary

This skill defines the commit standards, message format, validation requirements, and the strict **Human-In-The-Loop (HITL) Push Boundary** for all AI agents and contributors in the **GitHub Backup Automation System** repository.

---

## 1. Mandatory Local Branch First
 
> [!IMPORTANT]
> **ALWAYS CREATE A LOCAL BRANCH FIRST**:
> Before modifying any files or creating commits, the agent MUST verify they are on a dedicated local feature branch (`<github-username>/<parent-branch>/<feature>`).
> If currently on `main` or another base branch:
> ```bash
> git switch -c MishraShardendu22/main/<feature-name>
> ```
> NEVER make changes, staging, or commits directly on `main` or `dev`.

---

## 2. The Strict Push Permission Boundary

```text
┌─────────────────────────────────────────────────────────┐
│                      AGENT DOMAIN                       │
│                                                         │
│  1. Modify files                                        │
│  2. Run linters, type checks, and test suites           │
│  3. Create LOCAL Git commit (git commit)                │
└────────────────────────────┬────────────────────────────┘
                             │
                  [HUMAN REVIEW BOUNDARY]
                             │
┌────────────────────────────▼────────────────────────────┐
│                      HUMAN DOMAIN                       │
│                                                         │
│  4. Human inspects git diff and git log                 │
│  5. Human decides whether to push or request changes    │
│  6. Human executes git push origin <branch>             │
└─────────────────────────────────────────────────────────┘
```

> [!CAUTION]
> **PUSH & PULL REQUEST PERMISSION BOUNDARY**:
> * Agents are **permitted** to create local Git commits (`git commit`).
> * Agents must **never** run `git push` or create Pull Requests automatically.
> * Pushing to remote and opening a Pull Request is permitted **ONLY when explicitly requested by the human user** (e.g. *"create a PR to main"*).
> * All Pull Requests must target **`main`** only (never `dev`).

---

## 2. Pre-Commit Validation Checklist

Before staging files or creating a local commit, the agent/developer MUST ensure all validations pass:

```bash
# 1. Run the unified pre-commit validation gate
make pre-commit

# Or run individual project verifications:
make lint        # Checks Biome, Go vet, Pyright
make typecheck   # Runs Pyright (Python) and tsc (TypeScript)
make test        # Runs all Go and Python test suites
make build       # Builds Go binaries and Next.js frontend
```

If any validation step fails, fix the underlying code before attempting to commit.

---

## 3. Commit Message Standards (Conventional Commits)

All commits MUST follow the Conventional Commits specification:

```text
<type>(<optional-scope>): <short imperative description>

[optional body with rationale and technical details]

[optional footer(s)]
```

### Allowed Types
* `feat`: A new user-facing feature or API capability.
* `fix`: A bug fix or error resolution.
* `refactor`: Code restructuring without functional behavior changes.
* `perf`: Performance optimizations (e.g. database indexing, WebSocket throttling).
* `test`: Adding or updating test suites.
* `docs`: Documentation updates (README, ARCHITECTURE, SKILL.md).
* `chore`: Maintenance tasks, config tweaks, or dependency upgrades.
* `ci`: Continuous integration or pre-commit workflow changes.

### Allowed Scopes
* `backend`, `observatory`, `frontend`, `worker`, `db`, `api`, `websocket`, `embeddings`, `ci`, `skills`

### Good Examples
* `feat(observatory): add OpenRouter multi-key automatic failover`
* `fix(db): ensure migration 000005 applies idempotent schema changes`
* `test(backend): add unit tests for WebSocket client hub lifecycle`
* `docs(workflow): document branch creation and human review policy`

---

## 4. Mandatory Sign-off (`-s`) and Signing (`-S`) Flags

> [!IMPORTANT]
> **ALL COMMITS MUST BE SIGNED AND SIGNED-OFF**:
> Whenever an agent creates a Git commit, it MUST include both `-s` and `-S` flags:
> * **`-s` (`--signoff`)**: Adds the standard `Signed-off-by: Author <email>` trailer (DCO compliance).
> * **`-S` (`--gpg-sign`)**: Cryptographically signs the commit with the configured GPG/SSH signing key.

---

## 5. Local Commit Runbook for AI Agents

1. Check current branch and staged files:
   ```bash
   git status
   ```
2. Stage specific, relevant files (avoid blanket staging of temporary files):
   ```bash
   git add <path/to/modified-files>
   ```
3. Commit with mandatory `-s` and `-S` flags and a conventional message:
   ```bash
   git commit -s -S -m "<type>(<scope>): <clear description>"
   ```
4. Verify the commit was recorded locally with signature and sign-off:
   ```bash
   git log -n 1 --show-signature --stat
   ```
5. **STOP and inform the human developer**: Present the commit hash, summary, and notify the developer that the changes are ready for their personal review and push.
