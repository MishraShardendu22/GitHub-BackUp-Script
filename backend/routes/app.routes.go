package routes

import (
	"github.com/MishraShardendu22/github-backup/backend/handlers"
	"github.com/MishraShardendu22/github-backup/backend/middleware"
	"github.com/MishraShardendu22/github-backup/backend/websocket"
	"github.com/gofiber/fiber/v2"
	ws "github.com/gofiber/websocket/v2"
)

func Setup(app *fiber.App) {
	api := app.Group("/api")
	api.Use(middleware.RateLimitDefault())

	// backup handler
	api.Get("/backups", handlers.GetBackupRuns)
	api.Get("/backups/latest", handlers.GetLatestBackup)
	api.Get("/backups/:id", handlers.GetBackupRun)

	// dashboard handler
	api.Get("/dashboard/stats", handlers.GetDashboardStats)

	// metrics handler
	api.Get("/metrics", handlers.GetMetrics)
	api.Get("/logs", handlers.GetLogs)

	// repos handler
	api.Get("/repos", handlers.GetRepos)

	// fix handler
	api.Get("/backup-fixes", handlers.GetBackupFixes)
	api.Get("/backup-fixes/:id", handlers.GetBackupFix)
	api.Get("/backup-runs/:id/fixes", handlers.GetBackupRunFixes)

	// analytics handler
	api.Get("/analytics/history", handlers.GetAnalyticsRuns)
	api.Get("/analytics/latest", handlers.GetAnalyticsForLatestRun)
	api.Get("/analytics/:id", handlers.GetAnalyticsForSpecificRun)

	// checks the /ws routes whether the incoming request is asking for a WebSocket upgrade.
	app.Use("/ws", func(c *fiber.Ctx) error {
		//if yes, it's asking for upgrade then go to the next function
		if ws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws/live", ws.New(websocket.HandleWebSocket))
}

/*
	app.Use("/ws", ...) matches paths that start with /ws

	Match
	- /ws
	- /ws/
	- /ws/live
	- /ws/chat

	No Match
	- /abc/ws/live
	- /api/ws/live
	- /foo/bar/ws

*/
