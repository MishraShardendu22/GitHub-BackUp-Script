.PHONY: help dev test test-go test-py test-agents lint build backup-db restore-db hooks-install init-hooks pre-commit format typecheck

help:
	@echo "======================================================================"
	@echo "  GitHub Backup & Agentic Observatory System — Developer CLI"
	@echo "======================================================================"
	@echo "  make dev          - Start Go (8080), Python (8000), and Frontend (3000)"
	@echo "  make test         - Run all test suites across Go and Python"
	@echo "  make test-go      - Run Go backend and database unit tests"
	@echo "  make test-py      - Run Python Observatory unit tests"
	@echo "  make test-agents  - Run comprehensive AI Agent test suite"
	@echo "  make lint         - Run linters across Go, Python, and TypeScript"
	@echo "  make typecheck    - Run Pyright (Python) and tsc (TypeScript) type checks"
	@echo "  make format       - Auto-format Go and Frontend source code"
	@echo "  make build        - Compile Go binaries and Next.js build"
	@echo "  make hooks-install- Configure Git pre-commit hooks (.githooks)"
	@echo "  make pre-commit   - Run full pre-commit validation pipeline"
	@echo "  make backup-db    - Execute automated PostgreSQL backup"
	@echo "  make restore-db   - Restore PostgreSQL from backup file"
	@echo "======================================================================"

dev:
	@echo "🚀 Starting Go Backend (8080), Python Agent (8000), and Frontend (3000)..."
	@npx --yes concurrently -k -p "[{name}]" -n "Go-Backend,Python-Agent,Next-Frontend" -c "cyan.bold,magenta.bold,green.bold" \
		"cd backend && air" \
		"cd agentic-observatory && uv run uvicorn main:app --reload --port 8000" \
		"cd frontend && pnpm run dev"

test: test-go test-py

test-go:
	@echo "🧪 Running Go test suite..."
	@go test -v ./...

test-py:
	@echo "🧪 Running Python Observatory test suite..."
	@cd agentic-observatory && uv run python test_observability.py && uv run python test_openrouter_keys.py && uv run python test_agent_template.py && uv run python test_agent_suite.py

test-agents:
	@echo "🤖 Running AI Agent & Tool-Calling RAG Test Suite..."
	@cd agentic-observatory && uv run python test_agent_suite.py

lint:
	@echo "🔍 Running Biome linter on Frontend..."
	@cd frontend && pnpm run lint
	@echo "🔍 Running Go vet..."
	@go vet ./...
	@echo "🔍 Running Pyright on Python Observatory..."
	@cd agentic-observatory && uv run --with pyright pyright

typecheck:
	@echo "🔍 Running Pyright on Python Observatory..."
	@cd agentic-observatory && uv run --with pyright pyright
	@echo "🔍 Running TypeScript typecheck on Frontend..."
	@cd frontend && pnpm exec tsc --noEmit

format:
	@echo "✨ Formatting Go source code..."
	@gofmt -w backend/ config/ controller/ database/ model/ service/ util/ main.go 2>/dev/null || gofmt -w .
	@echo "✨ Formatting Frontend source code..."
	@cd frontend && pnpm run format

build:
	@echo "🏗️ Building Go binaries..."
	@go build -v ./...
	@echo "🏗️ Building Next.js Frontend..."
	@cd frontend && pnpm run build

hooks-install:
	@./scripts/install-hooks.sh

init-hooks: hooks-install

pre-commit:
	@PRECOMMIT_ALL=1 ./.githooks/pre-commit

backup-db:
	@echo "💾 Executing PostgreSQL backup..."
	@./scripts/backup-db.sh

restore-db:
	@echo "💾 Restoring PostgreSQL from backup..."
	@./scripts/restore-db.sh $(BACKUP_FILE)

