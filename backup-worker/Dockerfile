# ==============================================================================
# GitHub Backup Automation System — Backup Worker Dockerfile
# ==============================================================================
# Multi-stage build:
#   Stage 1 (builder) : Compile the Go CLI worker binary (CGO enabled for SQLite).
#   Stage 2 (runtime) : Alpine with git + openssh for repository operations.
#
# Build from repository root:
#   docker build -f backup-worker/Dockerfile -t github-backup-worker .
#
# Run (one-shot backup):
#   docker run --rm \
#     --env-file backup-worker/.env \
#     -v ./backup-worker/_Repos:/app/_Repos \
#     -v ./backup-worker/app.db:/app/app.db \
#     -v ~/.ssh:/root/.ssh:ro \
#     github-backup-worker
#
# Or via Docker Compose: docker compose run --rm backup-worker
#
# ⚠ WARNING: Do NOT run the worker container AND the local binary concurrently.
#   Both would attempt to write to the same app.db SQLite file.
# ==============================================================================

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

# CGO is required for go-sqlite3 (mattn/go-sqlite3 uses cgo)
RUN apk add --no-cache ca-certificates git openssh gcc musl-dev

WORKDIR /build

# Copy module files for cached dependency download
COPY go.mod go.sum ./
RUN go mod download

# Copy full source tree (backup-worker imports from root module)
COPY . .

# Build the worker binary with CGO enabled for SQLite support
RUN CGO_ENABLED=1 GOOS=linux \
    go build -trimpath -ldflags="-s -w" \
    -o /app/worker \
    ./backup-worker

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.22 AS runtime

# Runtime dependencies:
#   git           — clone/pull/push GitHub repositories
#   openssh-client — SSH authentication with GitHub
#   ca-certificates — TLS for Neon PostgreSQL and GitHub API
RUN apk add --no-cache ca-certificates git openssh-client

WORKDIR /app

# Copy the compiled binary
COPY --from=builder /app/worker /app/worker

# Create expected volume mount points
RUN mkdir -p /app/_Repos

# Volume declarations — mount at runtime
VOLUME ["/app/_Repos", "/root/.ssh"]

# The worker is a one-shot CLI: runs to completion then exits.
# Mount backup-worker/app.db → /app/app.db at runtime.
ENTRYPOINT ["/app/worker"]
