package logger

import (
	"context"
	"log/slog"
	"os"
	"strings"
)

var Log *slog.Logger

type ctxKey string

const RequestIDKey ctxKey = "request_id"

// InitLogger initializes the global structured slog logger.
func InitLogger(levelStr string) {
	var level slog.Level
	switch strings.ToLower(levelStr) {
	case "debug":
		level = slog.LevelDebug
	case "warn", "warning":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	})

	Log = slog.New(handler)
	slog.SetDefault(Log)
}

// WithRequestID returns a child logger enriched with the request ID.
func WithRequestID(ctx context.Context) *slog.Logger {
	if reqID, ok := ctx.Value(RequestIDKey).(string); ok && reqID != "" {
		return Log.With("request_id", reqID)
	}
	return Log
}

func Info(ctx context.Context, msg string, args ...any) {
	WithRequestID(ctx).Info(msg, args...)
}

func Warn(ctx context.Context, msg string, args ...any) {
	WithRequestID(ctx).Warn(msg, args...)
}

func Error(ctx context.Context, msg string, args ...any) {
	WithRequestID(ctx).Error(msg, args...)
}

func Debug(ctx context.Context, msg string, args ...any) {
	WithRequestID(ctx).Debug(msg, args...)
}

func init() {
	InitLogger("info")
}
