package handlers

import (
	"context"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/middleware"
	"github.com/MishraShardendu22/github-backup/backend/websocket"
	"github.com/gofiber/fiber/v2"
)

var startTime = time.Now()

// LivenessCheck returns 200 OK as long as the process is alive.
func LivenessCheck(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":         "ok",
		"uptime_seconds": time.Since(startTime).Seconds(),
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
	})
}

// ReadinessCheck verifies all critical backend dependencies (PostgreSQL database pool).
func ReadinessCheck(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	components := fiber.Map{
		"database": "connected",
		"websocket": fiber.Map{
			"active_clients": websocket.DefaultHub.ClientCount(),
		},
	}

	if db.Pool == nil {
		components["database"] = "uninitialized"
		return middleware.SendError(c, fiber.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Database pool uninitialized", components)
	}

	if err := db.Pool.Ping(ctx); err != nil {
		components["database"] = "disconnected: " + err.Error()
		return middleware.SendError(c, fiber.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Database ping failed", components)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":         "ready",
		"components":     components,
		"uptime_seconds": time.Since(startTime).Seconds(),
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
	})
}
