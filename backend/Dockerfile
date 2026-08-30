# ==============================================================================
# Go Backend API — Multi-Stage Production Dockerfile
FROM golang:alpine AS builder


WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /bin/server ./backend/main.go

# ------------------------------------------------------------------------------
# Production Runtime Stage
# ------------------------------------------------------------------------------
FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata curl && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /bin/server /app/server
COPY --from=builder /app/backend/db/migrations /app/backend/db/migrations

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/server"]
