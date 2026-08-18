.PHONY: help dev start backend agent frontend test

help:
	@echo "======================================================================"
	@echo "  GitHub Backup & Agentic Observatory System"
	@echo "======================================================================"
	@echo "  make dev      - Start all services concurrently (Go: 8080, Agent: 8000, Frontend: 3000)"
	@echo "  make backend  - Run Go backend server (http://localhost:8080)"
	@echo "  make agent    - Run Python Agentic Observatory (http://localhost:8000)"
	@echo "  make frontend - Run Next.js frontend (http://localhost:3000)"
	@echo "  make test     - Run End-to-End verification test suite"
	@echo "======================================================================"

backend:
	@echo "🚀 Starting Go backend on http://localhost:8080..."
	@cd backend && air

agent:
	@echo "🚀 Starting Python Agentic Observatory on http://localhost:8000..."
	@cd agentic-observatory && python3 -m uvicorn main:app --reload --port 8000

frontend:
	@echo "🚀 Starting Next.js frontend on http://localhost:3000..."
	@cd frontend && npm run dev

dev:
	@echo "🚀 Starting Go Backend (8080), Python Agent (8000), and Frontend (3000)..."
	@npx --yes concurrently -k -p "[{name}]" -n "Go-Backend,Python-Agent,Next-Frontend" -c "cyan.bold,magenta.bold,green.bold" \
		"cd backend && go run main.go" \
		"cd agentic-observatory && python3 -m uvicorn main:app --reload --port 8000" \
		"cd frontend && npm run dev"

start: dev

test:
	@echo "🧪 Running End-to-End verification tests..."
	@cd agentic-observatory && python3 e2e_test.py
