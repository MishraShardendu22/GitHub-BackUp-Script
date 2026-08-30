# Repository Rules for AI Agents

Welcome to the **GitHub Backup Automation System** repository. When working on, modifying, or improving this codebase, you MUST adhere to the following rules:

---

## 1. Architecture & Deployment Boundaries

* **Frontend**: Next.js 16 (App Router, Turbopack) -> Deployed on **Vercel**.
* **Python Observatory**: FastAPI + LangChain Tool-Calling RAG Agent + pgvector Hybrid Search -> Deployed on **Vercel**.
* **Go Backend**: Fiber v2 + pgxpool -> Deployed on **Render**.
* **Backup Worker**: Go CLI -> Dedicated `backup-worker/` directory (Local / Scheduled Cron via `make backup`).

> **CRITICAL RULE**: Do **NOT** introduce Docker, Docker Compose, Kubernetes, Helm, Nginx, Prometheus servers, Grafana containers, or container registries. All deployments use serverless Vercel and Render native runtimes.

---

## 2. Tool-Calling RAG & Vector Search Architecture

* **Dual-Layer RAG Pipeline**:
  1. **Pre-Turn Retrieval**: Queries pgvector & Full-Text Search (FTS) to inject top relevance chunks into system context.
  2. **Dynamic Tool Calling**: The agent dynamically calls `hybrid_search_knowledge_base` during reasoning loops to retrieve additional targeted chunks across `execution_logs`, `backup_results`, `backup_fixes`, `investigations`, and `chat_messages`.
* **Dynamic OpenRouter Model Registry**:
  * Free models are queried dynamically via OpenRouter API with modality filters (`output_modalities=embeddings`, `output_modalities=rerank`) and cached in-memory with fallback.
* **Vector Index Generations**:
  * Blue-Green style index generation (`BUILDING` -> `READY` -> `ACTIVE` -> `RETIRED`).
  * Chunking uses sliding window (default 500 chars, 50 overlap) and SHA-256 content hashing.

---

## 3. Database & Data Integrity

* **Never Drop Tables**: This system has been running in production with months of backup history. **Never** run destructive schema drops (`DROP TABLE`, `TRUNCATE`).
* **Migrations**: All migrations in `backend/db/migrations/` and `agentic-observatory/data/migrations/` MUST be idempotent using `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
* **Database Connection**: Always use `DATABASE_URL` (supports SSL with Neon PostgreSQL). In Python, `data/db.py` normalizes asyncpg URL formats automatically.

---

## 4. Configuration & Environment Variables

* **Centralized Extractors Only**:
  * **Go Backend**: `backend/config/config.go` (`config.Get()`).
  * **Backup Worker**: `backup-worker/config/data.config.go` (`config.LoadConfig()`).
  * **Python Observatory**: `agentic-observatory/config/settings.py` & `agentic-observatory/utils/env.py`.
  * **Frontend**: `frontend/src/config/env.ts` (`@/config/env`).
* **Secrets vs Hardcoded Defaults**:
  * Keep `.env` and `.env.example` strictly for **secrets** and **dynamic deployment URLs**.
  * Keep operational constants (timeouts, buffer limits, retry counts, page sizes) hardcoded in the centralized config files.

---

## 5. Multi-Key OpenRouter Failover

* `OPENROUTER_API_KEY` can contain comma-separated API keys.
* Always route OpenRouter operations through `utils.openrouter_keys` in Python and `EmbeddingClient` in Go. If an API key encounters `401`, `402`, or `429`, it automatically rotates to the next available key without failing user requests.

---

## 6. Human-In-The-Loop (HITL) Protocol

* Any sensitive destructive or outward-facing agent action (e.g. `send_report_email`, applying migrations, database hotfixes) MUST trigger the HITL confirmation protocol:
  1. Agent yields SSE event `{"type": "confirm_required", "confirm_id": "<uuid>", "name": "<tool_name>", "args": {...}}`.
  2. UI displays modal to user. User responds via `POST /chat/confirm`.
  3. Rejection or timeout (120s) gracefully feeds rejection message into LLM reasoning without crashing the session.

## 7. Git Branching, Commit Standards, Push & Pull Request Rules

* **Branch-First Development Workflow**: All development MUST follow a branch-first workflow on the primary repository clone:
  1. Determine the appropriate base branch (typically `main`).
  2. Ensure the base branch is up to date (`git pull origin main`).
  3. Create and switch to a new branch: `git switch -c <github-username>/<parent-branch>/<feature>`.
  4. Perform all development directly on that branch.
  5. Validate with `make pre-commit` and create local signed commits.
  6. Push and open PR targeting `main` only upon explicit user request.
* **Strict No-Worktree Rule**: Agents MUST NOT create Git worktrees for standard feature development, bug fixes, or maintenance tasks. Worktrees are strictly prohibited unless explicitly requested by the human user.
* **Branch Naming Conventions**: All branches MUST follow `<github-username>/<parent-branch>/<feature>`:
  * `<github-username>`: GitHub username of the author (e.g. `MishraShardendu22`).
  * `<parent-branch>`: Base branch (typically `main`).
  * `<feature>`: Concise kebab-case description of the feature or fix (e.g. `database-auto-sync`, `precommit-workflow`, `branch-first-migration`).
  * *Rules*: Lowercase, hyphen-separated (kebab-case), concise, no timestamps, no random suffixes.
* **Local Commits & Mandatory Signing**: Agents are permitted and encouraged to create local Git commits once all code quality and pre-commit checks pass. All commits MUST include the `-s` (sign-off) and `-S` (GPG signature) flags: `git commit -s -S -m "<type>(<scope>): <message>"`.
* **No Automatic Remote Push**: Agents MUST NOT execute `git push` or create remote branches automatically.
* **Explicit User Request for PR Creation**: When the human user explicitly instructs the agent to create a Pull Request (e.g. *"create a PR to main"*), the agent is authorized to push the branch to origin and open a PR using `gh pr create` with `--assignee "@me"`, `--label "type/<type>,area/<subsystem>,status/ready-for-review"`, and a structured, visually professional body per `.github/PULL_REQUEST_TEMPLATE.md`.
* **All Pull Requests Target `main` Only**: Every PR opened in this repository MUST target the **`main`** branch (never `dev` or temporary feature branches). See [`BRANCHING.md`](BRANCHING.md) and [`WORKFLOW.md`](WORKFLOW.md).
* **Pre-Commit Enforcement**: Always run `make pre-commit` before finalizing any changes or opening a PR.
* **PR & Issue Automation**: GitHub Actions workflows `.github/workflows/pr-triage-and-labeler.yml` and `.github/workflows/issue-triage.yml` automatically manage assignees, type/area/size labels, and triage cards. See [`.agents/skills/github-pr-issue-automation/SKILL.md`](.agents/skills/github-pr-issue-automation/SKILL.md).


---

## 8. Post-Merge Repository & Branch Cleanup Protocol

* **Strict Human-Triggered Cleanup Only**: Agents MUST NOT run local branch deletions or aggressive Git garbage collection automatically. Cleanup must be executed **ONLY** upon explicit human instruction (e.g. *"clean up local branches"*, *"sync main and do git gc"*, *"I merged the PR, please clean up"*).
* **Cleanup Execution Sequence**:
  1. Verify working directory is clean (`git status`).
  2. Switch to `main` branch (`git switch main`).
  3. Pull latest changes merged on GitHub (`git pull origin main`).
  4. Prune stale remote tracking references (`git fetch --prune origin`).
  5. Delete local merged feature branches (`git branch -d <branch>` / `git branch -D <branch>`) so that only `main` remains.
  6. Expire unreachable reflogs (`git reflog expire --expire=now --all`).
  7. Run deep repository garbage collection (`git gc --prune=now --aggressive` or `make git-clean`).
* See [`.agents/skills/git-post-merge-cleanup/SKILL.md`](.agents/skills/git-post-merge-cleanup/SKILL.md).

---

## 9. Verification Checklist

Before finishing any task, you MUST run:
```bash
# 1. Run all unit, integration, and AI agent test suites
make test

# 2. Run dedicated AI Agent & Tool-Calling RAG Test Suite
make test-agents

# 3. Run Python static type check
cd agentic-observatory && uv run --with pyright pyright

# 4. Run Frontend lint and Turbopack build
cd frontend && pnpm run lint && pnpm run build
```


