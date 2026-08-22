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
* Create an atomic Conventional Commit:
  ```bash
  git add <modified-files>
  git commit -m "feat(scope): concise description"
  ```

---

## 3. The Human Review Safety Boundary

> [!IMPORTANT]
> **STRICT AGENT PERMISSION RULE**:
> * **AI agents are NEVER allowed to push to any remote repository.**
> * The command `git push` is reserved exclusively for the human developer.
> * Once a local commit is created, the agent's turn is complete. The agent must present a clear summary of the local commits and await human review.

### Human Review Checklist
1. Inspect commit history: `git log -n 5 --stat`
2. Inspect diff against parent: `git diff <parent-branch>...HEAD`
3. Verify test runs locally if needed: `make test`
4. If approved, the human executes:
   ```bash
   git push origin <branch-name>
   ```

---

## 4. Summary Matrix

| Workflow Step | Performed By | Permitted for AI Agent? |
| :--- | :--- | :--- |
| **Branch Creation** | Contributor / Agent | **YES** (Local only) |
| **Code Changes** | Contributor / Agent | **YES** |
| **Testing & Linting** | Contributor / Agent | **YES** |
| **Local Commit** | Contributor / Agent | **YES** (Must pass pre-commit gate) |
| **Commit Review** | Human Developer | **HUMAN ONLY** |
| **Remote Push (`git push`)** | Human Developer | **HUMAN ONLY (Never Agent)** |
| **Pull Request & Merge** | Human Developer | **HUMAN ONLY** |
