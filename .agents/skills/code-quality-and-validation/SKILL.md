---
name: code-quality-and-validation
description: >-
  Standards, tools, and commands for code formatting, linting, and static type checking
  across Go, Python, and TypeScript.
---

# Code Quality & Validation Standards

This skill defines the multi-tier code quality, formatting, linting, and type checking standards across the **GitHub Backup Automation System** monorepo.

---

## 1. Tooling Matrix by Language

| Language | Subsystem | Formatter | Linter | Static Type Checker |
| :--- | :--- | :--- | :--- | :--- |
| **Go** | Backend & CLI | `gofmt` | `go vet ./...` | Go Compiler (`go build ./...`) |
| **Python** | Agentic Observatory | Ruff / Black compatible | Ruff check / Pyright | Pyright (`uv run --with pyright pyright`) |
| **TypeScript** | Next.js Frontend | Biome (`pnpm run format`) | Biome (`biome check`) | TypeScript Compiler (`tsc --noEmit`) |

---

## 2. Code Quality Rules

### 1. Go Guidelines
* Always format code using standard `gofmt` before committing.
* Zero compiler warnings or `go vet` issues allowed.
* Prefer structured logging via `util.Logger()` in CLI and `logger.Log` (`slog`) in `backend/`.
* Clean up goroutines and database connection handles using `defer`.

### 2. Python Observatory Guidelines
* Python 3.12+ type annotations required on all function arguments, return types, and Pydantic models.
* Zero errors in Pyright type checking (`agentic-observatory/pyrightconfig.json`).
* Ensure all async functions and SQLAlchemy sessions are properly awaited and closed.

### 3. Frontend TypeScript Guidelines
* Strict TypeScript checks with zero `any` types wherever possible.
* Use Biome for combined linting and code formatting (`frontend/package.json`).
* Ensure components render cleanly in Next.js Turbopack production builds.

---

## 3. Developer CLI Runbook

```bash
# Auto-format all Go and TypeScript files
make format

# Run all linters across Go, Python, and Frontend
make lint

# Run static type checkers across Python and Frontend
make typecheck

# Full pre-commit validation pass
make pre-commit
```
