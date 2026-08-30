# ==============================================================================
# Backup Worker CLI — Multi-Stage Dockerfile
FROM golang:alpine AS builder


WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /bin/worker ./backup-worker/main.go

# ------------------------------------------------------------------------------
# Production Runtime Stage
# ------------------------------------------------------------------------------
FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata openssh-client curl && \
    addgroup -S workergroup && adduser -S workeruser -G workergroup && \
    mkdir -p /tmp/github-backups && chown -R workeruser:workergroup /tmp/github-backups

COPY --from=builder /bin/worker /app/worker

USER workeruser

VOLUME ["/tmp/github-backups"]

ENTRYPOINT ["/app/worker"]
