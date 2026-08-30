---
name: git-commit-workflow
description: >-
  High-priority rules, message formats, commit design taxonomy, and strict permission boundaries for creating frequent local Git commits.
  Enforces that AI agents and human contributors create granular, explanatory, categorized commits at each important milestone.
---

# Git Commit Design & Workflow Standards

This skill defines the **Commit Design Taxonomy**, commit classification standards, message conventions, validation requirements, and the strict **Human-In-The-Loop (HITL) Push Boundary** for all AI agents and human contributors in the **GitHub Backup Automation System** repository.

---

## 1. High-Priority Rule: Frequent, Atomic & Explanatory Commits

> [!IMPORTANT]
> **COMMIT FREQUENTLY AT EACH LOGICAL STEP (More Commits = More Explanatory Work)**:
> * AI agents and developers MUST prioritize creating granular, atomic Git commits at **each important milestone** or distinct phase of work rather than bundling everything into one monolithic commit at the end.
> * Each commit MUST encapsulate a **single logical responsibility** (e.g. creating Dockerfiles, adding an API route, optimizing a database index, updating UI styling, documentation updates).
> * **Never mix unrelated concerns in a single commit** (e.g. do NOT combine a database migration with a frontend UI redesign).
> * Granular commits make code reviews clear, bisecting simple, rollbacks safe, and capture explanatory architectural progress in the repository history.

---

## 2. Commit Design Taxonomy & Classification

All commits in this repository MUST be classified under one of the standard commit categories outlined below. Agents must only construct commits adhering strictly to this taxonomy:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      COMMIT DESIGN TAXONOMY                             │
├───────────────┬─────────────────────────────────────────────────────────┤
│ feat          │ Feature Addition (new capability, endpoint, service)    │
│ perf          │ Performance Optimization (caching, query/vector speed)  │
│ refactor      │ Structural Improvement (cleaner code, zero logic change)│
│ fix           │ Bug Fix & Error Resolution (runtime fix, edge cases)    │
│ ui / style    │ UI & Visual Design (Tailwind, components, theme, layout)│
│ ci / deploy   │ CI/CD, Containerization & DevOps (Actions, Docker, YAML)│
│ db            │ Database & Migration (idempotent schemas, pgvector)     │
│ test          │ Testing & Quality Assurance (unit, mock, agent tests)   │
│ docs          │ Documentation & Specifications (README, SKILL.md, docs) │
│ chore         │ Routine Maintenance (dependency updates, tool configs)  │
└───────────────┴─────────────────────────────────────────────────────────┘
```

---

### Category 1: Feature Addition (`feat`)
* **Purpose**: Adding new functional capabilities, API endpoints, worker tasks, AI agent tools, connector vault integrations, or background services.
* **Format**: `feat(<scope>): <short imperative description>`
* **Criteria**: Introduces new executable functionality. Must include all necessary code and interfaces for that specific feature slice.
* **Allowed Scopes**: `backend`, `observatory`, `frontend`, `worker`, `agent`, `connectors`, `storage`, `mcp`, `api`
* **Examples**:
  - `feat(observatory): add OpenRouter multi-key automatic failover client`
  - `feat(worker): implement SHA-256 archive checksum generation and verification`
  - `feat(connectors): add AES-256 encrypted credential vault repository`
  - `feat(mcp): implement native GitHub Backup MCP server tool handlers`

---

### Category 2: Improvement & Optimization (`perf`, `refactor`)
* **Purpose**: Enhancing execution speed, decreasing memory footprint, reducing LLM token consumption, accelerating vector search, or restructuring code without changing user-observable behavior.
* **Format**:
  - Performance: `perf(<scope>): <short imperative description>`
  - Restructuring: `refactor(<scope>): <short imperative description>`
* **Criteria**: Code maintains 100% backward compatibility and passes existing test suites while delivering measurable efficiency or architectural clarity gains.
* **Allowed Scopes**: `db`, `vector`, `observatory`, `backend`, `worker`, `cache`, `websocket`
* **Examples**:
  - `perf(db): add GIN index on execution_logs for sub-millisecond FTS queries`
  - `perf(observatory): cache OpenRouter model capability registry in-memory`
  - `refactor(backend): consolidate WebSocket hub client connection lifecycle`
  - `refactor(worker): decouple backup execution loop from direct database calls`

---

### Category 3: Fix & Bug Resolution (`fix`)
* **Purpose**: Resolving runtime defects, unexpected panics, unhandled exceptions, race conditions, type mismatches, network timeout errors, or secret scanner alerts.
* **Format**: `fix(<scope>): <short imperative description>`
* **Criteria**: Addresses a specific malfunction or regression. The commit message body should explain the root cause and the fix applied.
* **Allowed Scopes**: `agent`, `docker`, `ci`, `db`, `auth`, `api`, `worker`, `frontend`
* **Examples**:
  - `fix(agent): prevent session crash by rotating OpenRouter key on 429 rate limit`
  - `fix(docker): enable --ignore-scripts in Next.js builder for pnpm 10 compatibility`
  - `fix(db): ensure migration 000004 applies idempotent alter column statement`
  - `fix(ci): resolve go.mod toolchain version mismatch in GitHub Actions runner`

---

### Category 4: UI & Visual Design (`ui`, `style`)
* **Purpose**: Creating or refining user interfaces, dashboard components, Tailwind CSS styling, responsive grid layouts, dark/light theme palettes, data charts, and interaction animations.
* **Format**: `ui(<scope>): <short imperative description>` or `feat(ui): <short imperative description>`
* **Criteria**: Confined to visual presentation, component UX, styling, and design system elements without modifying backend business logic.
* **Allowed Scopes**: `dashboard`, `analytics`, `backups`, `ai-chat`, `connectors`, `theme`, `components`
* **Examples**:
  - `ui(dashboard): modernize real-time backup run progress cards and status badges`
  - `ui(analytics): add interactive latency distribution charts with recharts`
  - `ui(theme): implement high-contrast dark mode color palette for AI chat`
  - `ui(components): add confirmation modal for Human-In-The-Loop agent approvals`

---

### Category 5: CI/CD, Containerization & DevOps (`ci`, `deploy`)
* **Purpose**: Managing GitHub Actions workflows, multi-stage Dockerfiles, Docker Compose files, Render blueprints (`render.yaml`), Vercel project configurations, and Git hooks.
* **Format**: `ci(<scope>): <short imperative description>` or `feat(deploy): <short imperative description>`
* **Criteria**: Infrastructure as Code, automation pipelines, build tooling, and container packaging.
* **Allowed Scopes**: `actions`, `docker`, `render`, `vercel`, `hooks`, `precommit`
* **Examples**:
  - `ci(actions): implement production-grade automated CI/CD pipeline with Docker Hub`
  - `feat(deploy): configure Render Blueprint and Vercel project configurations`
  - `ci(docker): switch Go builder to golang:alpine for multi-platform compatibility`
  - `feat(hooks): configure comprehensive pre-commit and pre-push validation gates`

---

### Category 6: Database & Schema Evolution (`db`)
* **Purpose**: Creating idempotent SQL schema migrations, adding pgvector vector columns, defining indexes, setting up Neon database branching scripts, or configuring connection pools.
* **Format**: `db(<scope>): <short imperative description>` or `feat(db): <short imperative description>`
* **Criteria**: Never uses destructive `DROP TABLE` or `TRUNCATE`. Must use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
* **Allowed Scopes**: `migrations`, `neon`, `pgvector`, `indexes`, `pool`
* **Examples**:
  - `db(migrations): add 000006_create_connectors_table for encrypted credential vault`
  - `feat(database): implement Neon multi-environment database branching scripts`
  - `db(pgvector): add HNSW vector index generation lifecycle triggers`

---

### Category 7: Testing & Quality Assurance (`test`)
* **Purpose**: Adding or improving unit test suites, integration tests, mock HTTP/WebSocket servers, AI agent multi-turn conversation evaluation fixtures, and static test runners.
* **Format**: `test(<scope>): <short imperative description>`
* **Criteria**: Expands test coverage or adds regression test cases without modifying production runtime code.
* **Allowed Scopes**: `observatory`, `backend`, `worker`, `frontend`, `e2e`, `agent`
* **Examples**:
  - `test(observatory): add test suite for multi-turn HITL confirmation workflow`
  - `test(backend): add unit tests for WebSocket client hub lifecycle and message relay`
  - `test(worker): add mock GitHub API server for repository deduplication tests`

---

### Category 8: Documentation & Architectural Blueprints (`docs`)
* **Purpose**: Updating repository guides, architecture documents, system diagrams, Agent skills (`.agents/skills/`), CHANGELOG notes, and developer setup instructions.
* **Format**: `docs(<scope>): <short imperative description>`
* **Criteria**: Changes strictly confined to Markdown files, diagrams, or inline documentation.
* **Allowed Scopes**: `roadmap`, `architecture`, `skills`, `deployment`, `readme`, `changelog`
* **Examples**:
  - `docs(roadmap): specify enterprise SaaS transformation and native MCP ecosystem`
  - `docs(skills): document commit design taxonomy and authenticated CLI tooling guide`
  - `docs(deployment): document automated CI/CD pipeline and Neon branching runbooks`

---

## 3. Mandatory Local Branch First

> [!IMPORTANT]
> **ALWAYS CREATE A LOCAL BRANCH FIRST**:
> Before modifying any files or creating commits, the agent/developer MUST verify they are on a dedicated local feature branch (`<github-username>/<parent-branch>/<feature>`).
> ```bash
> git switch -c MishraShardendu22/main/<feature-name>
> ```
> NEVER make changes, staging, or commits directly on `main` or `dev`.

---

## 4. The Strict Push Permission Boundary (HITL)

```text
┌─────────────────────────────────────────────────────────┐
│                      AGENT DOMAIN                       │
│                                                         │
│  1. Modify files for specific logical milestone         │
│  2. Run linters, type checks, and pre-commit gates      │
│  3. Create LOCAL signed Git commit (git commit -s -S)   │
│  4. Repeat steps 1-3 for each milestone                 │
└────────────────────────────┬────────────────────────────┘
                             │
                  [HUMAN REVIEW BOUNDARY]
                             │
┌────────────────────────────▼────────────────────────────┐
│                      HUMAN DOMAIN                       │
│                                                         │
│  5. Human inspects git diff and git log                 │
│  6. Human decides whether to push or request changes    │
│  7. Human executes git push origin <branch> (or prompts)│
└─────────────────────────────────────────────────────────┘
```

> [!CAUTION]
> **NO AUTOMATIC REMOTE PUSH**:
> * Agents are **permitted and encouraged** to create local Git commits (`git commit -s -S`).
> * Agents must **never** run `git push` or create Pull Requests automatically without explicit user instruction.
> * Pushing to remote and opening a Pull Request is permitted **ONLY when explicitly requested by the human user** (e.g. *"create a PR to main"*).
> * All Pull Requests must target **`main`** only.

---

## 5. Mandatory Sign-off (`-s`) and Signing (`-S`) Flags

> [!IMPORTANT]
> **ALL COMMITS MUST BE SIGNED AND SIGNED-OFF**:
> Whenever an agent or developer creates a Git commit, it MUST include both `-s` and `-S` flags:
> * **`-s` (`--signoff`)**: Adds the standard `Signed-off-by: Author <email>` trailer (DCO compliance).
> * **`-S` (`--gpg-sign`)**: Cryptographically signs the commit with the configured GPG/SSH signing key.

---

## 6. Pre-Commit Validation Checklist

Before staging files or creating a local commit, the agent MUST verify that the code passes validation:

```bash
# Unified pre-commit validation gate
make pre-commit

# Or individual verifications:
make lint        # Checks Biome, Go vet, Pyright
make typecheck   # Runs Pyright (Python) and tsc (TypeScript)
make test        # Runs Go and Python test suites
make build       # Builds Go binaries and Next.js frontend
```

---

## 7. Step-by-Step Commit Runbook for AI Agents

Follow this exact sequence whenever recording progress:

1. **Check Working Tree & Staged Changes**:
   ```bash
   git status
   ```

2. **Stage Granular Files for Current Milestone**:
   ```bash
   # Stage only files belonging to this logical milestone
   git add <path/to/relevant/files>
   ```

3. **Select Appropriate Category from Commit Design Taxonomy**:
   - `feat(...)` for feature additions
   - `perf(...)` / `refactor(...)` for improvements & optimizations
   - `fix(...)` for bugs & error resolution
   - `ui(...)` / `style(...)` for frontend & design
   - `ci(...)` / `deploy(...)` for CI/CD, Docker & DevOps
   - `db(...)` for database migrations & schemas
   - `test(...)` for test suites
   - `docs(...)` for documentation & skills

4. **Execute Signed Commit**:
   ```bash
   git commit -s -S -m "<type>(<scope>): <clear descriptive summary>"
   ```

5. **Verify Commit Signature & Metadata**:
   ```bash
   git log -n 1 --show-signature --stat
   ```

