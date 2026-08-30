---
name: jules-ai-engineering-workflow
description: >-
  Standard operating procedures for the autonomous Jules AI engineering review-improve-converge loop,
  evaluating code across 38 architectural dimensions and preparing merge-ready PRs for the human Technical Lead.
---

# Jules Autonomous AI Engineering Review & Improvement Loop

This skill establishes the standard operating framework for the autonomous AI-driven engineering pipeline in the **GitHub Backup Automation System** repository. Under this framework, concurrent AI engineers author implementations and open Pull Requests, while **Google Jules CLI** immediately performs multi-dimensional, principal staff-grade code reviews and autonomous remediation cycles until the PR achieves production convergence—requiring only final high-level signoff from the human **Technical Lead**.

---

## 1. Pipeline Architecture & Tech Lead Delegation Model

```mermaid
flowchart TD
    AI[AI Engineer creates Feature Branch & PR] --> JulesReview[Jules Multi-Dimensional Staff Review]
    JulesReview --> Check{Quality Score >= 95% & Zero P0/P1?}
    Check -- No (P0/P1/P2 Found) --> Remediation[Jules Auto-Remediation Session / AI Engineer Patch]
    Remediation --> Validate[make pre-commit && make test]
    Validate --> Push[Commit & Push Improvements]
    Push --> JulesReview
    Check -- Yes (Converged) --> Finalize[Synthesize Staff-Grade PR Description & Apply Approval Labels]
    Finalize --> TechLead[Human Technical Lead Final Decision & 1-Click Merge]
```

### Roles & Responsibilities
* **AI Engineers**: Implement feature tasks, write comprehensive unit/integration test suites, update corresponding agent skills and documentation, and open Pull Requests targeting `main`.
* **Jules Review Engine**: Evaluates PRs across 38 dimensions with the rigor of a Principal Staff Engineer, posts transparent audit comments to GitHub threads, and triggers automated remediation loops.
* **Human Technical Lead**: Validates high-level product direction, evaluates non-obvious engineering tradeoffs, and provides final merge authorization. All mechanical, stylistic, performance, and maintainability concerns are guaranteed to be resolved before the Tech Lead reviews.

---

## 2. The 38 Principal Staff Review Dimensions

Every review rigorously grades the implementation across these 38 engineering facets:

| # | Dimension | Principal Staff Audit Criteria |
| :-: | :--- | :--- |
| **1** | **Correctness** | Logic integrity, edge-case coverage, and zero regression guarantee |
| **2** | **Architecture** | Strict adherence to deployment boundaries (Vercel serverless, Render Go backend) |
| **3** | **System Design** | Microservice decoupling, single-responsibility, and scalable service interfaces |
| **4** | **Scalability** | Horizontal scaling capability, stateless handlers, and connection pool sizing |
| **5** | **Performance** | Sub-millisecond database queries, non-blocking I/O, minimal bundle size |
| **6** | **Time/Space Complexity** | Algorithmic efficiency: $O(1)$ / $O(\log N)$ lookups, zero unbounded $O(N^2)$ loops |
| **7** | **Concurrency Safety** | Safe mutex locking, zero data races, connection pool thread safety |
| **8** | **Distributed Systems** | Idempotency keys, exponential backoff with jitter, partition resilience |
| **9** | **API Design** | RESTful HTTP semantics, typed JSON envelopes, real-time WebSocket protocol |
| **10** | **Maintainability** | Clean code, low cyclomatic complexity, clear domain naming |
| **11** | **Readability** | Idiomatic Go, Python, and TypeScript; self-documenting code |
| **12** | **Extensibility** | Pluggable storage providers (S3/R2/GDrive) and OpenRouter registries |
| **13** | **Modularity** | Clean module boundaries, zero circular package dependencies |
| **14** | **Error Handling** | Structured error envelopes, typed error codes, zero unhandled panics |
| **15** | **Security** | Zero raw credentials/secrets, AES-256 encrypted vaults, SSL PostgreSQL |
| **16** | **Reliability** | Automatic OpenRouter multi-key failover on 401/402/429, retry policies |
| **17** | **Observability** | Real-time WebSocket broadcasting, SSE streaming traces, telemetry |
| **18** | **Logging** | Structured JSON logs with ISO timestamps, log levels, request_id correlation |
| **19** | **Metrics** | Duration histograms, throughput gauges, error counters |
| **20** | **Tracing** | Distributed `request_id` correlation across Frontend, Backend, and Observatory |
| **21** | **Testing Quality** | Unit, integration, mock server, and AI agent multi-turn test suites |
| **22** | **Edge Cases** | Empty payloads, network timeouts, upstream rate limits, concurrent writes |
| **23** | **Failure Recovery** | Automatic database reconnection, graceful service degradation |
| **24** | **Documentation** | Autonomous synchronization of `docs/`, `README.md`, `CHANGELOG.md`, `.agents/skills/` |
| **25** | **Code Duplication** | DRY compliance, centralized configuration extractors |
| **26** | **Dependencies** | Minimal footprint, frozen lockfiles (`pnpm-lock.yaml`, `uv.lock`) |
| **27** | **Resource Usage** | Zero open file descriptor leaks, bounded buffer allocations |
| **28** | **Memory Efficiency** | Streaming response readers, zero heap memory accumulation |
| **29** | **CPU Efficiency** | Vectorized embeddings, pre-compiled regular expressions |
| **30** | **I/O Efficiency** | Asynchronous disk/network writes, buffered file flushes |
| **31** | **Database Efficiency** | Indexed SQL queries, pgvector cosine search, zero full table scans |
| **32** | **Network Efficiency** | HTTP/2 keep-alive, compressed JSON payloads, batched vector embeddings |
| **33** | **CI/CD Compatibility**| Zero-containerization compliance for Vercel/Render, dynamic secrets |
| **34** | **Production Readiness**| Healthcheck endpoints (`/health`), live probes, zero debug flags |
| **35** | **Backward Compatibility**| Idempotent DDL migrations (`IF NOT EXISTS`, no `DROP`/`TRUNCATE`) |
| **36** | **Coding Standards** | 0 Biome lint errors, `gofmt` formatted, 0 Pyright type errors |
| **37** | **Repository Conventions**| Canonical branch naming `<user>/<base>/<feature>`, signed commits (`-s -S`) |
| **38** | **Project-Specific Rules**| Serverless deployment boundaries, multi-key failover, HITL confirmation |

---

## 3. Acceptance Criteria for Automatic Approval

A Pull Request is declared **Converged** and automatically approved by Jules when:
1. **Quality Score $\ge 95/100$**: Evaluated across all 38 dimensions.
2. **Zero P0 Blockers**: No correctness bugs, security vulnerabilities, destructive schema drops, or secret leaks.
3. **Zero P1 Architectural Violations**: Strict adherence to serverless deployment boundaries and centralized config extractors.
4. **100% Test Suite Pass**: All Go, Python, and shell test suites pass.
5. **Zero Lint & Type Errors**: Pyright, Biome, and Go vet pass cleanly.
6. **Autonomous Doc & Skill Sync Verified**: All affected documentation and agent skills are updated.

---

## 4. Jules CLI Developer Commands & Operations

The Jules CLI is installed as a first-class tool. Developers and agents can run:

```bash
# 1. Trigger Jules review loop locally on a PR
./scripts/jules-review-loop.sh --pr <pr-number>

# 2. Preview review evaluation without making changes
./scripts/jules-review-loop.sh --pr <pr-number> --dry-run

# 3. Create a remote Jules remediation session
jules new "Refactor database query to avoid N+1 scans in backup worker"

# 4. List active remote Jules sessions
jules remote list --session

# 5. Pull and apply session patch to local repository
jules remote pull --session <session-id> --apply

# 6. Teleport into a remote Jules session workspace
jules teleport <session-id>

# 7. Generate final staff-grade PR description for Tech Lead
./scripts/jules-review-loop.sh --generate-final-pr
```

---

## 5. Makefile Targets

* `make jules-review PR=<pr-number>`: Runs the full Jules review loop on a PR.
* `make jules-fix PR=<pr-number>`: Dispatches Jules automated fix session.
* `make jules-status`: Checks status of active remote Jules sessions.
