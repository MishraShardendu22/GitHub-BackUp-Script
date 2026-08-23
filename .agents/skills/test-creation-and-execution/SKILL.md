---
name: test-creation-and-execution
description: >-
  Rules, patterns, and runbooks for writing and running unit, integration, and AI agent test suites
  across Go, Python Observatory, and Next.js frontend.
---

# Test Creation & Execution Skill

This skill defines the testing standards, frameworks, conventions, and execution workflows for the **GitHub Backup Automation System** polyglot monorepo.

## 1. Branch-First Development

> [!IMPORTANT]
> **CREATE A LOCAL BRANCH FIRST**: Always start by creating a local branch from `main`:
> ```bash
> git switch -c MishraShardendu22/main/<feature-name>
> ```
> Never write tests or code directly on `main`.

---

## 2. Testing Architecture & Frameworks

| Subsystem | Location | Framework & Tooling | Primary Test Command |
| :--- | :--- | :--- | :--- |
| **Go Backend & Worker** | `backend/` & `backup-worker/` | Standard Go `testing`, `httptest` | `make test-go` (`go test -v -race ./...`) |
| **Python Observatory** | `agentic-observatory/` | Python `unittest`, `unittest.mock`, `httpx` | `make test-py` |
| **AI Agent & RAG** | `agentic-observatory/` | Tool-calling mocks, LangChain agent harness | `make test-agents` |
| **Frontend** | `frontend/` | Next.js Turbopack compiler, TypeScript `tsc` | `cd frontend && pnpm exec tsc --noEmit` |

---

## 3. Go Test Creation Standards

### File Naming & Package Placement
* Test files MUST reside in the same package and end with `_test.go` (e.g. `backend/handlers/health_test.go`).
* Package declarations match the production package (e.g. `package handlers` or `package handlers_test` for black-box testing).

### Table-Driven Tests Pattern
Always prefer table-driven testing in Go:

```go
package config_test

import (
	"testing"
	"github.com/MishraShardendu22/github-backup/backend/config"
)

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name    string
		envMap  map[string]string
		wantErr bool
	}{
		{
			name: "valid configuration",
			envMap: map[string]string{
				"DATABASE_URL":    "postgres://user:pass@localhost:5432/db",
				"INTERNAL_SECRET": "secret123",
			},
			wantErr: false,
		},
		{
			name:    "missing required database url",
			envMap:  map[string]string{},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set environment, run validation, and assert
		})
	}
}
```

### Mocking Fiber HTTP Handlers
```go
app := fiber.New()
routes.Setup(app)

req := httptest.NewRequest("GET", "/health", nil)
resp, err := app.Test(req)
if err != nil || resp.StatusCode != fiber.StatusOK {
    t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
}
```

---

## 3. Python Observatory Test Creation Standards

### File Placement & Naming
* Unit tests reside in `agentic-observatory/` with prefix `test_*.py` (e.g. `test_observability.py`, `test_openrouter_keys.py`, `test_agent_suite.py`).

### Mocking OpenRouter & Async Endpoints
* Never perform live external API calls during automated tests.
* Use `unittest.mock.patch` to mock `httpx.AsyncClient` or `ChatOpenAI`:

```python
import unittest
from unittest.mock import AsyncMock, patch
from main import app
from httpx import AsyncClient, ASGITransport

class TestObservabilityAPI(unittest.IsolatedAsyncioTestCase):
    async def test_health_endpoint(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["status"], "healthy")
```

---

## 4. Test Execution Runbook

```bash
# 1. Run all test suites across the monorepo
make test

# 2. Run Go backend and database unit tests
make test-go

# 3. Run Python Observatory test suite
make test-py

# 4. Run dedicated AI Agent & Tool-Calling RAG test suite
make test-agents

# 5. Run targeted Go package test
go test -v ./backend/handlers/...

# 6. Run single Python test file
cd agentic-observatory && uv run python -m unittest test_observability.py
```

---

## 5. Pre-Commit Verification
Always run `make test` and `make test-agents` before staging and committing any code changes.
