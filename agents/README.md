# Repository Agent Skills Directory

This directory provides specialized operational skills and procedural runbooks for AI agents working in the **GitHub Backup Automation System** repository.

---

## Skills Inventory

| Skill | Directory | Description |
| :--- | :--- | :--- |
| **Branch Management** | [`skills/git-branch-management/`](skills/git-branch-management/SKILL.md) | Branch-first development policy, hierarchical naming (`<github-username>/<parent-branch>/<feature>`), and lifecycle rules. |
| **Commit Workflow** | [`skills/git-commit-workflow/`](skills/git-commit-workflow/SKILL.md) | Conventional Commits, validation checklist, and the strict **Human-In-The-Loop Push Boundary** (agents never push remotely). |
| **Test Creation & Execution** | [`skills/test-creation-and-execution/`](skills/test-creation-and-execution/SKILL.md) | Writing and executing test suites across Go, Python Observatory, and Next.js frontend. |
| **CI/CD & Deployments** | [`skills/ci-cd-workflow/`](skills/ci-cd-workflow/SKILL.md) | GitHub Actions CI matrix, deployment targets (Vercel & Render), and zero-containerization rule. |
| **Code Quality & Validation** | [`skills/code-quality-and-validation/`](skills/code-quality-and-validation/SKILL.md) | Formatting (`gofmt`, Biome), linting (`go vet`, Biome, Pyright), and static type checking. |
| **Pre-Commit Management** | [`skills/precommit-workflow-management/`](skills/precommit-workflow-management/SKILL.md) | Operating `.githooks/pre-commit`, staged-file detection, and bypass flags. |
| **Repository Maintenance** | [`skills/repository-maintenance/`](skills/repository-maintenance/SKILL.md) | Database integrity, idempotent SQL migrations, backup/restore runbooks, and dependency management. |
| **Documentation Sync** | [`skills/doc-synchronization/`](skills/doc-synchronization/SKILL.md) | Procedures for keeping documentation, architecture guides, changelogs, and skills synchronized with code. |
| **Pull Request Management** | [`skills/pull-request-management/`](skills/pull-request-management/SKILL.md) | Guidelines and runbooks for creating PRs to `main` upon explicit user request. |
| **Observatory Architecture** | [`skills/agent-observatory-workflow/`](skills/agent-observatory-workflow/SKILL.md) | Python AI Observatory, LangChain tools, pgvector embeddings, and OpenRouter multi-key failover. |
| **Codebase Simplification** | [`skills/codebase-simplification-guide/`](skills/codebase-simplification-guide/SKILL.md) | Principles for keeping code minimal, maintainable, and free of unnecessary abstractions. |
| **System Architecture** | [`skills/github-backup-architecture/`](skills/github-backup-architecture/SKILL.md) | End-to-end architecture, database schema, and cross-service communication. |

---

## Agent Discovery & Loading

Skills in this directory are linked to `.agents/skills/` and loaded dynamically via the Antigravity skill discovery engine.
