## 🎯 Pull Request Overview

<!-- Concise executive summary of what this change accomplishes and why it is required -->

**Fixes / Relates to**: <!-- (e.g. #123, or N/A) -->

---

### 📦 Type of Change

- [ ] `feat`: New feature, API capability, or system extension
- [ ] `fix`: Bug fix, error resolution, or regression fix
- [ ] `perf`: Performance optimization, caching, query/vector latency reduction
- [ ] `refactor`: Structural improvement without behavioral changes
- [ ] `ui`: Frontend components, styling, design system, themes
- [ ] `ci`: CI/CD pipelines, Dockerfiles, deployment automation
- [ ] `db`: Database schema evolution, idempotent SQL migrations
- [ ] `test`: Test suite additions, mocks, AI agent benchmarks
- [ ] `docs`: Documentation, architecture blueprints, agent skills

---

### 🏗️ Subsystem Impact & Boundaries

| Subsystem | Impacted? | Description of Changes |
| :--- | :---: | :--- |
| **Go Backend (Fiber API & WebSockets)** | [ ] | <!-- e.g., New REST endpoint /api/v1/... --> |
| **Python Observatory (FastAPI & RAG Agent)** | [ ] | <!-- e.g., New LangChain tool / OpenRouter failover --> |
| **Next.js Frontend (App Router & Turbopack)** | [ ] | <!-- e.g., Dashboard metrics visualizer --> |
| **Backup Worker CLI (Go SQLite Engine)** | [ ] | <!-- e.g., Pre-run database synchronization --> |
| **Database & Migrations (Neon PostgreSQL)** | [ ] | <!-- e.g., 00000X migration table --> |
| **CI/CD & DevOps Automation (GitHub Actions)** | [ ] | <!-- e.g., Automated branch cleanup / Docker build --> |

---

### 🧪 Quality Assurance & Test Verification

- [ ] `make test`: All unit and integration test suites pass across Go, Python, and scripts
- [ ] `make test-agents`: Dedicated AI Agent & Tool-Calling RAG Test Suite passes 100%
- [ ] `make typecheck` / `pyright`: Python static type analysis passes with 0 errors
- [ ] `make lint` / `pnpm run lint`: Biome linter and TypeScript compiler pass
- [ ] `make pre-commit`: Full pre-commit validation gate passed successfully

---

### 🛡️ Security & Zero-Secret Certification

- [ ] Verified that **no credentials, API keys, database URLs, or real tokens** are committed
- [ ] All sensitive actions adhere to Human-In-The-Loop (HITL) protocol where required
- [ ] Centralized configuration extractors utilized (no raw `os.Getenv` scattered across packages)
- [ ] Database migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)

---

### 📚 Autonomous Skill & Documentation Sync

- [ ] All relevant **Agent Skills** (`.agents/skills/`) inspected and updated
- [ ] Architecture guides (`docs/`) and `README.md` updated
- [ ] Release notes added to `CHANGELOG.md` under `## [Unreleased]`
