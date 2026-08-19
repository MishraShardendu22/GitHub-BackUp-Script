package handlers

import (
	"strings"

	"github.com/MishraShardendu22/github-backup/backend/metrics"
	"github.com/MishraShardendu22/github-backup/backend/websocket"
	"github.com/gofiber/fiber/v2"
)

// GetSystemMetrics exports system metrics in Prometheus format (default or when requested) or JSON format.
func GetSystemMetrics(c *fiber.Ctx) error {
	wsCount := websocket.DefaultHub.ClientCount()
	format := c.Query("format")
	accept := c.Get("Accept")

	if format == "json" || (strings.Contains(accept, "application/json") && format != "prometheus") {
		return c.JSON(metrics.DefaultMetrics.Snapshot(wsCount))
	}

	c.Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	return c.SendString(metrics.DefaultMetrics.PrometheusExport(wsCount))
}
