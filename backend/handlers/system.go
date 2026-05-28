package handlers

import (
	"context"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/gofiber/fiber/v2"
)

func GetSystemHealth(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if _, err := db.FinalizeStaleRunningRuns(ctx, 30*time.Minute); err != nil {
		_ = err
	}

	dbOk := true
	if err := db.Pool.Ping(ctx); err != nil {
		dbOk = false
	}

	// Check if worker is running (has a 'running' backup_run)
	var workerRunning bool
	var currentRunID *int
	err := db.Pool.QueryRow(ctx, `SELECT id FROM backup_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1`).Scan(&currentRunID)
	if err == nil && currentRunID != nil {
		workerRunning = true
	}

	return c.JSON(fiber.Map{
		"status":         "ok",
		"database":       dbOk,
		"worker_running": workerRunning,
		"current_run_id": currentRunID,
		"timestamp":      time.Now(),
	})
}

func GetLiveStatus(c *fiber.Ctx) error {
	ctx := context.Background()
	if _, err := db.FinalizeStaleRunningRuns(ctx, 30*time.Minute); err != nil {
		_ = err
	}

	var status struct {
		ID         int       `json:"id"`
		Status     string    `json:"status"`
		TotalRepos int       `json:"total_repos"`
		Successful int       `json:"successful"`
		Failed     int       `json:"failed"`
		Skipped    int       `json:"skipped"`
		StartedAt  time.Time `json:"started_at"`
	}

	err := db.Pool.QueryRow(ctx,
		`SELECT id, status, total_repos, successful, failed, skipped, started_at
		 FROM backup_runs ORDER BY started_at DESC LIMIT 1`).Scan(
		&status.ID, &status.Status, &status.TotalRepos, &status.Successful,
		&status.Failed, &status.Skipped, &status.StartedAt)
	if err != nil {
		return c.JSON(fiber.Map{"worker_running": false})
	}

	return c.JSON(fiber.Map{
		"worker_running": status.Status == "running",
		"run":            status,
	})
}
