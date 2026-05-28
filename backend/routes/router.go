package routes

import (
	"github.com/MishraShardendu22/github-backup/backend/handlers"
	"github.com/MishraShardendu22/github-backup/backend/websocket"
	"github.com/gofiber/fiber/v2"
	ws "github.com/gofiber/websocket/v2"
)

func Setup(app *fiber.App) {
	api := app.Group("/api")

	// Backups
	api.Get("/backups", handlers.GetBackupRuns)
	api.Get("/backups/latest", handlers.GetLatestBackup)
	api.Get("/backups/:id", handlers.GetBackupRun)

	// Dashboard
	api.Get("/dashboard/stats", handlers.GetDashboardStats)

	// Metrics
	api.Get("/metrics", handlers.GetMetrics)

	// Logs
	api.Get("/logs", handlers.GetLogs)

	// Repos
	api.Get("/repos", handlers.GetRepos)

	// AI
	api.Post("/ai/chat", handlers.PostChat)
	api.Get("/ai/conversations", handlers.GetConversations)
	api.Get("/ai/conversations/:id", handlers.GetConversation)
	api.Delete("/ai/conversations/:id", handlers.DeleteConversation)

	// Reports
	api.Get("/reports/latest", handlers.GetLatestReport)
	api.Post("/reports/latest", handlers.GetLatestReport)
	api.Post("/reports/send", handlers.SendReport)
	api.Get("/reports/history", handlers.GetReportHistory)

	// System
	api.Get("/system/health", handlers.GetSystemHealth)
	api.Get("/system/live", handlers.GetLiveStatus)

	// WebSocket
	app.Use("/ws", func(c *fiber.Ctx) error {
		if ws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws/live", ws.New(websocket.HandleWebSocket))
}
