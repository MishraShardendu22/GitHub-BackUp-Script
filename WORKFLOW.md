# End-to-End Repository Workflow & Human-Review Boundary

This document defines the complete engineering lifecycle for contributors and AI agents working on the **GitHub Backup Automation System**. It establishes an explicit **Human-In-The-Loop (HITL) Push Boundary** ensuring all changes are thoroughly reviewed before reaching remote branches.

---

## 1. The Engineering Workflow Pipeline

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. BRANCH CREATION                                          │
│    Create local branch: <user>/<parent>/<change>            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. DEVELOPMENT                                              │
│    Implement focused changes, update docs, maintain types   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. VALIDATION & TESTS                                       │
│    Run 'make pre-commit', 'make test', 'make lint'          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. LOCAL COMMIT                                             │
│    Stage files, create Conventional Commit locally          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ═══════════════════════════════
                 [HUMAN REVIEW SAFETY BOUNDARY]
                ═══════════════════════════════
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. HUMAN INSPECTION & DECISION                              │
│    Developer inspects diff, tests, and commit log           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. REMOTE PUSH (HUMAN ONLY)                                 │
│    Human runs 'git push origin <branch>'                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. PR & CI/CD MERGE                                         │
│    GitHub Actions CI validation → PR Merge into Parent      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Stage Breakdown & Protocol

### Stage 1: Branch Creation
* Determine the appropriate parent branch (`main` or an active epic such as `MishraShardendu22/dev/cleanup`).
* Create a local branch adhering to [`BRANCHING.md`](BRANCHING.md):
  ```bash
  git switch -c MishraShardendu22/dev/cleanup/feature-name
  ```

### Stage 2: Development & Documentation
* Implement changes following the repository rules in [`AGENTS.md`](AGENTS.md).
* Keep code minimal, clean, and maintainable.
* Update corresponding documentation in `docs/`, `README.md`, and `CHANGELOG.md` under `## [Unreleased]`.

### Stage 3: Multi-Tier Validation
* Execute the pre-commit gate before committing:
  ```bash
  make pre-commit
  ```
* Ensure all 8 validation phases succeed (formatting, static analysis, unit tests, agent tests, binary builds, and Next.js Turbopack compilation).

### Stage 4: Local Commit
* Create an atomic Conventional Commit with mandatory sign-off (`-s`) and cryptographic signing (`-S`):
  ```bash
  git add <modified-files>
  git commit -s -S -m "feat(scope): concise description"
  ```

---

## 3. The Human Review Safety Boundary & Pull Request Policy

> [!IMPORTANT]
> **PULL REQUESTS TARGET `main` ONLY**:
> All Pull Requests in this repository MUST target the **`main`** branch. `main` is the sole production integration branch. Never target `dev` or temporary feature branches.

> [!IMPORTANT]
> **AGENT PUSH & PR PERMISSION BOUNDARY**:
> * By default, AI agents commit locally and **do not push** or create Pull Requests automatically.
> * When the human developer **specifically and explicitly instructs the agent to open a PR** (e.g. *"create a PR to main"*), the agent is authorized to push the local branch and open the PR against `main` via `gh pr create --base main`.

### Human Review Checklist
1. Inspect commit history: `git log -n 5 --stat`
2. Inspect diff against parent: `git diff main...HEAD`
3. Verify test runs locally if needed: `make test`
4. If opening PR yourself:
   ```bash
   git push -u origin <branch-name>
   gh pr create --base main --head <branch-name> --title "<type>(<scope>): <title>" --body "..."
   ```

---

## 4. Summary Matrix

| Workflow Step | Performed By | Permitted for AI Agent? |
| :--- | :--- | :--- |
| **Branch Creation** | Contributor / Agent | **YES** (Local only) |
| **Code Changes** | Contributor / Agent | **YES** |
| **Testing & Linting** | Contributor / Agent | **YES** |
| **Local Commit** | Contributor / Agent | **YES** (Must pass pre-commit gate) |
| **Commit Review** | Human Developer | **HUMAN REVIEW** |
| **Remote Push (`git push`)** | Human / Agent (on request) | **ONLY WHEN EXPLICITLY REQUESTED BY USER** |
| **Create PR (`gh pr create --base main`)** | Human / Agent (on request) | **ONLY WHEN EXPLICITLY REQUESTED BY USER (Target: `main` only)** |
| **PR Merge into `main`** | Human Developer | **HUMAN ONLY** |

