---
name: docker-first-architecture
description: >-
  Rules, architectures, multi-stage Dockerfile blueprints, and container-first workflows for all microservices, frontends, and backends targeting Docker Hub, AWS ECS/EKS, and self-hosting.
---

# Docker-First & Image-First Architecture Skill

This skill defines the official architectural guidelines, containerization blueprints, and publishing standards across all services in the personal projects ecosystem. It enforces a **Docker-First and Image-First** doctrine to guarantee infrastructure portability from Vercel/Render edge environments to AWS (Terraform + ECS/EKS) and sovereign self-hosting.

---

## 1. Overview & Objective

Every service—regardless of language or framework—must be fully containerized, reproducible, and published to Docker Hub (`shardendumishra22/*`).

### Portability Roadmap
1. **Phase 1 (Current)**: Hybrid Edge/PaaS (Vercel serverless frontends, Render container backends, Neon serverless PostgreSQL, Docker Hub registry).
2. **Phase 2 (Cloud Evolution)**: AWS Cloud Native (Terraform IaC, AWS ECS Fargate or EKS, Application Load Balancers, CloudFront, Docker Hub / ECR).
3. **Phase 3 (Sovereign Infrastructure)**: Self-Hosted Bare Metal / VPS (Docker Compose / Nomad / K3s, Traefik / Nginx reverse proxy, automated backup sync).

---

## 2. Core Directives & Toolchain Standards

> [!IMPORTANT]
> **OPTIMAL TOOLCHAIN MANDATE**: Always employ the fastest, most deterministic tools:
> - **Node.js / TypeScript**: `pnpm` exclusively (via Corepack). Never use `npm` or legacy `yarn`.
> - **Python**: `uv` exclusively (`ghcr.io/astral-sh/uv:latest`). Never use plain `pip` or slow virtualenv setups.
> - **Go**: Static compilation (`CGO_ENABLED=0`, `-ldflags="-w -s"`). Never deploy dynamic glibc-dependent Go binaries.
> - **Static Frontends (Preact / Svelte / React)**: Multi-stage `pnpm` builder with `nginx:alpine` runner.

### Mandatory Container Hardening Rules:
1. **Multi-Stage Builds**: Build tooling, SDKs, and source compilers MUST NEVER exist in the production runtime stage.
2. **Non-Root Execution**: Every runtime image MUST define and execute as an unprivileged user (`nextjs`, `appuser`, `workeruser`).
3. **Healthcheck Directives**: Every service image MUST include an active `HEALTHCHECK` probing its readiness endpoint.
4. **Minimal Attack Surface**: Base runtime stages on `alpine:3.21`, `python:3.12-slim`, or `distroless`.
5. **Context Efficiency**: Every project MUST contain a `.dockerignore` pruning `node_modules`, `.git`, test artifacts, and caches.
6. **Automated Docker Hub Registry**: Every repository MUST include a GitHub Actions workflow building and publishing multi-platform or linux/amd64 images to `shardendumishra22/<image-name>`.

---

## 3. Technology Blueprints

### Blueprint A: Next.js 16 Standalone (Node 22 + pnpm)
* `next.config.ts` must set `output: "standalone"`.
* Multi-stage build copies `.next/standalone`, `.next/static`, and `public`.
* Runs as `nextjs:nodejs` on port 3000.

### Blueprint B: Static SPAs (Preact / Svelte 5 / Vite + Nginx)
* Builds static assets to `dist/` with `pnpm --filter <app> build`.
* Deploys into `nginx:alpine`.
* Custom `nginx.conf` handles SPA routing fallback (`try_files $uri $uri/ /index.html;`), gzip compression, and `/health`.

### Blueprint C: Go 1.25 API / Microservice
* `golang:alpine` builder with `go mod download`.
* Static compilation: `CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /bin/server .`.
* Runtime stage: `alpine:3.21` with `ca-certificates`, `tzdata`, `curl`, running as `appuser`.

### Blueprint D: Python 3.12 AI / API Service (FastAPI + uv)
* Installs `uv` from `ghcr.io/astral-sh/uv:latest`.
* `uv sync --frozen --no-dev --no-install-project` with `UV_COMPILE_BYTECODE=1`.
* Runtime stage: `python:3.12-slim` with unprivileged `appuser`.

### Blueprint E: Express 5 + TypeScript + Drizzle API
* Compiles TypeScript to `dist/`.
* Prunes dependencies with `pnpm install --prod --frozen-lockfile`.
* Runtime stage: `node:22-alpine` with non-root `appuser`.

---

## 4. Verification & Testing Runbook

```bash
# 1. Validate Docker daemon is operational
docker info

# 2. Build image locally with Buildx
docker build -t shardendumishra22/<service-name>:local .

# 3. Test local container execution & healthcheck
docker run -d --name test-<service-name> -p <port>:<port> shardendumishra22/<service-name>:local
sleep 5
docker ps --filter name=test-<service-name>
curl -f http://localhost:<port>/health || exit 1
docker rm -f test-<service-name>

# 4. Verify Compose environment
docker compose up -d
docker compose ps
docker compose down
```
