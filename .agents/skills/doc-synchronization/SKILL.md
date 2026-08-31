---
name: doc-synchronization
description: >-
  High-priority rules and automated procedures for continuously keeping repository documentation, API references,
  architecture guides, changelogs, and agent skills synchronized with code changes autonomously without requiring human reminders.
---

# Autonomous Documentation & Skill Synchronization Engine

This skill establishes the **Zero-Reminder Automatic Synchronization Rule**: whenever ANY code, API, database schema, workflow, or architecture change is introduced or modified in the repository, all corresponding architectural documents, API references, READMEs, changelogs, and AI agent skills (`.agents/skills/`) MUST be automatically inspected, updated, and expanded by the agent **without requiring any prompting or reminders from the human user**.

---

## 1. High-Priority Rule: Zero-Reminder Automatic Synchronization

> [!IMPORTANT]
> **AUTONOMOUS DOCUMENTATION & SKILL UPDATES (No Human Prompting Needed)**:
> * AI agents are strictly required to treat **Agent Skills (`.agents/skills/`)** and **Documentation (`docs/`, `README.md`, `CHANGELOG.md`)** as first-class codebase artifacts.
> * Every feature addition (`feat`), improvement (`perf`/`refactor`), bug fix (`fix`), database migration (`db`), or DevOps pipeline (`ci`) MUST automatically trigger a synchronization pass across relevant skills and markdown specifications before finalizing commits.
> * The human developer should **NEVER** have to ask: *"please update the docs"* or *"please update the agent skills"*. This is a mandatory, automated built-in reflex.

---

## 2. Subsystem-to-Skill & Documentation Synchronization Matrix

Whenever modifying files in any subsystem, the agent MUST automatically update the corresponding documentation and skill files:

| Subsystem Modified | Source Locations | Required Documentation & Skill Updates |
| :--- | :--- | :--- |
| **Git Workflow & Branching** | `.githooks/`, `scripts/git-*.sh`, `.github/workflows/` | • [`.agents/skills/git-commit-workflow/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/git-commit-workflow/SKILL.md)<br>• [`.agents/skills/git-branch-management/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/git-branch-management/SKILL.md)<br>• [`.agents/skills/git-post-merge-cleanup/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/git-post-merge-cleanup/SKILL.md)<br>• [`AGENTS.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/AGENTS.md)<br>• [`docs/PRECOMMIT_WORKFLOW.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/PRECOMMIT_WORKFLOW.md)<br>• [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md) |
| **Database & Migrations** | `backend/db/migrations/`, `agentic-observatory/data/migrations/`, `scripts/neon-*.sh` | • [`.agents/skills/repository-maintenance/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/repository-maintenance/SKILL.md)<br>• [`.agents/skills/github-backup-architecture/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/github-backup-architecture/SKILL.md)<br>• [`docs/ARCHITECTURE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/ARCHITECTURE.md)<br>• [`README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/README.md) (Migration Table)<br>• [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md) |
| **AI Observatory & RAG** | `agentic-observatory/agent/`, `agentic-observatory/data/tools/`, `agentic-observatory/utils/` | • [`.agents/skills/agent-observatory-workflow/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/agent-observatory-workflow/SKILL.md)<br>• [`docs/ARCHITECTURE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/ARCHITECTURE.md)<br>• [`agentic-observatory/README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/agentic-observatory/README.md)<br>• [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md) |
| **SaaS Connectors & BYO Storage** | `backend/connectors/`, `backup-worker/storage/`, `agentic-observatory/connectors/` | • [`.agents/skills/saas-and-mcp-architecture/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/saas-and-mcp-architecture/SKILL.md)<br>• [`docs/SAAS_ARCHITECTURE_AND_MCP_ROADMAP.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/SAAS_ARCHITECTURE_AND_MCP_ROADMAP.md)<br>• [`docs/ARCHITECTURE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/ARCHITECTURE.md)<br>• [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md) |
| **Model Context Protocol (MCP)** | Native MCP Server, MCP tool handlers | • [`.agents/skills/saas-and-mcp-architecture/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/saas-and-mcp-architecture/SKILL.md)<br>• [`docs/SAAS_ARCHITECTURE_AND_MCP_ROADMAP.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/SAAS_ARCHITECTURE_AND_MCP_ROADMAP.md)<br>• [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md) |
| **Go Backend & REST APIs** | `backend/handlers/`, `backend/routes/`, `backend/models/` | • [`docs/API_REFERENCE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/API_REFERENCE.md)<br>• [`docs/ARCHITECTURE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/ARCHITECTURE.md)<br>• [`backend/README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/backend/README.md) |
| **CLI & Worker Engine** | `backup-worker/main.go`, `backup-worker/service/`, `backup-worker/config/` | • [`README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/README.md)<br>• [`docs/ARCHITECTURE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/ARCHITECTURE.md)<br>• [`backup-worker/README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/backup-worker/README.md) |
| **Frontend & UI Dashboard** | `frontend/src/app/`, `frontend/src/components/`, `frontend/src/services/` | • [`README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/README.md)<br>• [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md) |
| **CI/CD & Deployment** | `.github/workflows/`, `*Dockerfile`, `render.yaml`, `*vercel.json` | • [`.agents/skills/ci-cd-workflow/SKILL.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/.agents/skills/ci-cd-workflow/SKILL.md)<br>• [`docs/DEPLOYMENT_GUIDE.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/docs/DEPLOYMENT_GUIDE.md)<br>• [`README.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/README.md)<br>• [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md) |

---

## 3. Autonomous Skill Creation & Evolution Rule

* **When to Create a New Agent Skill (`.agents/skills/<name>/SKILL.md`)**:
  * Whenever introducing a new architectural pattern, operational domain, or subsystem that future AI agents must interact with or maintain (e.g. `saas-and-mcp-architecture`, `git-post-merge-cleanup`, `cli-tooling-guide`).
  * Format: Include YAML frontmatter (`name`, `description`) and comprehensive operational guidelines, rules, and example commands.
* **When to Update Existing Skills**:
  * Whenever modifying runtime behaviors, adding flags to scripts, updating CLI commands, or changing deployment configurations.
  * Keep skills concise, actionable, and strictly synchronized with the live implementation.

---

## 4. Pre-Commit Autonomous Synchronization Checklist

Before executing `git commit` or finalizing any milestone, execute this 4-step checklist:

1. **Inspect Staged/Modified Files**:
   ```bash
   git status --short
   ```
2. **Cross-Reference Subsystem Matrix**: Identify all target docs and agent skills impacted by the modified files.
3. **Apply Documentation & Skill Edits**: Update markdown files and skills with exact details.
4. **Log in Changelog**: Add concise bullet points under `## [Unreleased]` in [`CHANGELOG.md`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/CHANGELOG.md).
5. **Sync Skills Upstream**: If any skill inside `.agents/skills/` was added or modified, execute `skills-sync push` (or `make skills-push`) to propagate updates to `MishraShardendu22/agent-skills`.

