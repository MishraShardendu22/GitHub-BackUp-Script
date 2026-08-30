# ==============================================================================
# GitHub Backup Automation System — Go Backend Dockerfile
# ==============================================================================
# Multi-stage build:
#   Stage 1 (builder) : Compile the Go binary using the full Go toolchain.
#   Stage 2 (runtime) : Copy the compiled binary into a minimal distroless image.
#
# Build from repository root:
#   docker build -f backend/Dockerfile -t github-backup-backend .
#
# Run:
#   docker run -p 8080:8080 --env-file backend/.env github-backup-backend
# ==============================================================================

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache ca-certificates git

WORKDIR /build

# Copy module files first for layer-cached dependency download
COPY go.mod go.sum ./
RUN go mod download

# Copy the full source tree (backend imports shared root modules)
COPY . .

# Build the backend binary — statically linked, no CGO
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" \
    -o /app/backend \
    ./backend

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.22 AS runtime

RUN apk add --no-cache ca-certificates wget

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy the compiled binary
COPY --from=builder /app/backend /app/backend

EXPOSE 8080

USER appuser:appgroup

ENTRYPOINT ["/app/backend"]

