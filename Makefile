.PHONY: help dev backup test test-go test-py test-agents lint build backup-db restore-db hooks-install init-hooks pre-commit format typecheck git-clean \
        docker-up docker-down docker-build docker-logs docker-backup docker-shell-backend docker-shell-observatory docker-clean

help:
	@echo "======================================================================"
	@echo "  GitHub Backup & Agentic Observatory System — Developer CLI"
	@echo "======================================================================"
	@echo "  ── Native Development ──────────────────────────────────────────────"
	@echo "  make dev          - Start Go (8080), Python (8000), and Frontend (3000)"
	@echo "  make backup       - Run the autonomous Backup Worker CLI"
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
	@echo "  make git-clean    - Sync main branch, delete local feature branches, and run git gc"
	@echo "  make backup-db    - Execute automated PostgreSQL backup"
	@echo "  make restore-db   - Restore PostgreSQL from backup file"
	@echo "  ── Docker Development ──────────────────────────────────────────────"
	@echo "  make docker-up    - Build images and start all services via Docker Compose"
	@echo "  make docker-down  - Stop and remove all containers"
	@echo "  make docker-build - Build (or rebuild) all Docker images"
	@echo "  make docker-logs  - Tail live logs from all containers"
	@echo "  make docker-backup- Run the backup worker container (one-shot)"
	@echo "  make docker-shell-backend    - Open a shell in the backend container"
	@echo "  make docker-shell-observatory- Open a shell in the observatory container"
	@echo "  make docker-clean - Remove all project containers, images, and volumes"
	@echo "======================================================================"


dev:
	@echo "Starting Go Backend (8080), Python Agent (8000), and Frontend (3000)..."
	@npx --yes concurrently -k -p "[{name}]" -n "Go-Backend,Python-Agent,Next-Frontend" -c "cyan.bold,magenta.bold,green.bold" \
		"cd backend && air" \
		"cd agentic-observatory && uv run uvicorn main:app --reload --port 8000" \
		"cd frontend && pnpm run dev"

backup:
	@echo "Running Backup Worker CLI..."
	@cd backup-worker && go run main.go

test: test-go test-py

test-go:
	@echo "Running Go test suite..."
	@go test -v ./...

test-py:
	@echo "Running Python Observatory test suite..."
	@cd agentic-observatory && uv run python test_observability.py && uv run python test_openrouter_keys.py && uv run python test_agent_template.py && uv run python test_agent_suite.py

test-agents:
	@echo "Running AI Agent & Tool-Calling RAG Test Suite..."
	@cd agentic-observatory && uv run python test_agent_suite.py

lint:
	@echo "Running Biome linter on Frontend..."
	@cd frontend && pnpm run lint
	@echo "Running Go vet..."
	@go vet ./...
	@echo "Running Pyright on Python Observatory..."
	@cd agentic-observatory && uv run --with pyright pyright

typecheck:
	@echo "Running Pyright on Python Observatory..."
	@cd agentic-observatory && uv run --with pyright pyright
	@echo "Running TypeScript typecheck on Frontend..."
	@cd frontend && pnpm exec tsc --noEmit

format:
	@echo "Formatting Go source code..."
	@gofmt -w backend/ backup-worker/ 2>/dev/null || gofmt -w .
	@echo "Formatting Frontend source code..."
	@cd frontend && pnpm run format

build:
	@echo "Building Go binaries..."
	@go build -v ./...
	@echo "Building Next.js Frontend..."
	@cd frontend && pnpm run build

hooks-install:
	@./scripts/install-hooks.sh

init-hooks: hooks-install

pre-commit:
	@PRECOMMIT_ALL=1 ./.githooks/pre-commit

backup-db:
	@echo "Executing PostgreSQL backup..."
	@./scripts/backup-db.sh

restore-db:
	@echo "Restoring PostgreSQL from backup..."
	@./scripts/restore-db.sh $(BACKUP_FILE)

git-clean:
	@echo "Synchronizing main branch and cleaning up repository..."
	@git switch main
	@git pull origin main
	@git fetch --prune origin
	@echo "Deleting stale local feature branches..."
	@git branch | grep -v "^\* main$$" | grep -v "^  main$$" | xargs -r git branch -D || true
	@echo "Running Git garbage collection and reflog pruning..."
	@git reflog expire --expire=now --all
	@git gc --prune=now --aggressive
	@echo "Repository clean. Current active branch: main"

# ==============================================================================
# Docker Development Targets
# ==============================================================================
# Primary workflow: `make docker-up` starts backend, observatory, and frontend.
# The backup worker is run separately: `make docker-backup`
# ==============================================================================

docker-up:
	@echo "Building images and starting all web services via Docker Compose..."
	@docker compose up --build -d
	@echo ""
	@echo "Services running:"
	@echo "  Go Backend     → http://localhost:8080"
	@echo "  Observatory    → http://localhost:8000"
	@echo "  Frontend       → http://localhost:3000"
	@echo ""
	@echo "Run 'make docker-logs' to tail logs. Run 'make docker-down' to stop."

docker-down:
	@echo "Stopping all Docker Compose services..."
	@docker compose down

docker-build:
	@echo "Building all Docker images..."
	@docker compose build

docker-logs:
	@docker compose logs -f

docker-backup:
	@echo "Running Backup Worker container (one-shot)..."
	@docker compose run --rm backup-worker

docker-shell-backend:
	@docker compose exec backend sh

docker-shell-observatory:
	@docker compose exec observatory bash

docker-clean:
	@echo "Removing all project containers, images, and volumes..."
	@docker compose down --rmi local --volumes --remove-orphans
	@echo "Docker resources cleaned."

