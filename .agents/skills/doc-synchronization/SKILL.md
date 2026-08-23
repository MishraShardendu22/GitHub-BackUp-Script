---
name: doc-synchronization
description: >-
  Rules and procedures for continuously keeping repository documentation, API references, architecture guides,
  changelogs, and agent skills synchronized with code changes, and adding new docs when required.
---

# Documentation Synchronization & Maintenance Skill

This skill ensures that whenever any changes are introduced to the codebase, all corresponding architectural documents, API references, READMEs, changelogs, and AI agent skills are automatically inspected, updated, and expanded.

## 1. Branch-First Development

> [!IMPORTANT]
> **CREATE A LOCAL BRANCH FIRST**: Always start by creating a local branch from `main`:
> ```bash
> git switch -c MishraShardendu22/main/<feature-name>
> ```
> Never develop docs or code directly on `main`.

---

## 2. When to Trigger Documentation Updates

Any of the following changes MUST trigger documentation synchronization:

1. **Database & Schema Changes**:
   * New SQL migrations, table creations, column modifications, or index additions.
   * Updates to PostgreSQL schema constraints, lifecycle policies, or data models.
2. **API & Endpoint Changes**:
   * New REST routes, query parameters, request/response body schemas in Go Backend (`backend/handlers/`) or Python Observatory (`agentic-observatory/main.py`).
   * WebSocket message formats or SSE event schemas.
3. **Agent & AI Observability Changes**:
   * New LangChain tools added under `agentic-observatory/data/tools/`.
   * Changes to multi-key OpenRouter failover, embedding pipelines, or HITL protocols.
4. **Configuration & Environment Variable Changes**:
   * New environment variables or default settings added to `backend/config/`, `agentic-observatory/config/`, or `frontend/src/config/`.
5. **Frontend Features & UI Capabilities**:
   * New dashboard pages, analytics visualizers, or AI playground controls.

---

## 2. Source-to-Documentation Mapping Matrix

| Changed Subsystem | Primary Source Files | Target Documentation Files to Update |
| :--- | :--- | :--- |
| **Git Workflow & Branching** | `.githooks/`, `BRANCHING.md`, `WORKFLOW.md` | • [`BRANCHING.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/BRANCHING.md)<br>• [`WORKFLOW.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/WORKFLOW.md)<br>• [`docs/PRECOMMIT_WORKFLOW.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/PRECOMMIT_WORKFLOW.md)<br>• [`AGENTS.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/AGENTS.md)<br>• [`.agents/skills/git-branch-management/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/git-branch-management/SKILL.md)<br>• [`.agents/skills/git-commit-workflow/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/git-commit-workflow/SKILL.md)<br>• [`.agents/skills/pull-request-management/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/pull-request-management/SKILL.md) |
| **Database & Migrations** | `backend/db/migrations/`, `backend/db/schema.sql`, `agentic-observatory/data/migrations/` | • [`docs/ARCHITECTURE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/ARCHITECTURE.md)<br>• [`README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/README.md) (Migration Table)<br>• [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md)<br>• [`.agents/skills/github-backup-architecture/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/github-backup-architecture/SKILL.md) |
| **Backend & REST APIs** | `backend/handlers/`, `backend/routes/`, `backend/models/` | • [`docs/API_REFERENCE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/API_REFERENCE.md)<br>• [`docs/ARCHITECTURE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/ARCHITECTURE.md)<br>• [`backend/README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/backend/README.md) |
| **AI Observatory & RAG** | `agentic-observatory/agent/`, `agentic-observatory/data/`, `agentic-observatory/data/tools/` | • [`docs/ARCHITECTURE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/ARCHITECTURE.md)<br>• [`agentic-observatory/README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/agentic-observatory/README.md)<br>• [`.agents/skills/agent-observatory-workflow/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/agent-observatory-workflow/SKILL.md) |
| **CLI & Worker Engine** | `backup-worker/main.go`, `backup-worker/service/`, `backup-worker/config/` | • [`README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/README.md)<br>• [`docs/ARCHITECTURE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/ARCHITECTURE.md)<br>• [`backup-worker/README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/backup-worker/README.md) |
| **Frontend Dashboard** | `frontend/src/app/`, `frontend/src/services/` | • [`README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/README.md)<br>• [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md) |

---

## 3. Creating New Documentation & Skills

* **New Documentation Files (`docs/`)**:
  * Create a new markdown file in `docs/` (e.g. `docs/DISASTER_RECOVERY.md`, `docs/TELEMETRY_GUIDE.md`) whenever a feature introduces a distinct operational domain that exceeds the scope of `ARCHITECTURE.md` or `API_REFERENCE.md`.
  * Link the new document from [`README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/README.md) under **Live Resources** or **Architecture & Deployment Model**.
* **New Agent Skills (`.agents/skills/`)**:
  * Create a new folder under `.agents/skills/<skill-name>/` containing `SKILL.md` whenever introducing a repeatable engineering workflow, architectural protocol, or deployment pattern that future AI agents need to follow.

---

## 4. Pre-Completion Documentation Checklist

Before finalizing any task or pushing commits, execute this 4-step checklist:

1. **Review Diff**: Run `git diff --stat` to identify all modified code, config, and schema files.
2. **Update Docs**: Check the Source-to-Documentation matrix and edit relevant `.md` files.
3. **Log in Changelog**: Add concise, human-readable bullet points under `## [Unreleased]` in [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md).
4. **Validate Skills**: Ensure all `.agents/skills/*/SKILL.md` files match the latest implementations.
