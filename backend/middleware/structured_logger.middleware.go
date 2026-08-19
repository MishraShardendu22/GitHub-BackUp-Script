package middleware

import (
	"log/slog"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/logger"
	"github.com/MishraShardendu22/github-backup/backend/metrics"
	"github.com/gofiber/fiber/v2"
)

// StructuredLoggerMiddleware logs each HTTP request in structured format and collects metrics.
func StructuredLoggerMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		reqID := GetRequestID(c)

		// Execute downstream handlers
		err := c.Next()

		duration := time.Since(start)
		status := c.Response().StatusCode()
		if err != nil {
			if fiberErr, ok := err.(*fiber.Error); ok {
				status = fiberErr.Code
			} else {
				status = fiber.StatusInternalServerError
			}
		}

		path := c.Path()
		method := c.Method()

		// Record metrics
		metrics.DefaultMetrics.RecordHTTPRequest(method, path, status, duration)

		// Determine log level
		level := slog.LevelInfo
		if status >= 500 {
			level = slog.LevelError
		} else if status >= 400 {
			level = slog.LevelWarn
		}

		attrs := []slog.Attr{
			slog.String("request_id", reqID),
			slog.String("method", method),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Float64("duration_ms", float64(duration.Microseconds())/1000.0),
			slog.String("client_ip", c.IP()),
		}

		if err != nil {
			attrs = append(attrs, slog.String("error", err.Error()))
		}

		logger.Log.LogAttrs(c.Context(), level, "HTTP request completed", attrs...)

		return err
	}
}
