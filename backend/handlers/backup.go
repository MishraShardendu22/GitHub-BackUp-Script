package handlers

import (
	"context"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/gofiber/fiber/v2"
)

func GetBackupRuns(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 20)
	offset := c.QueryInt("offset", 0)

	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, status, started_at, completed_at, total_repos, successful, failed, skipped, duration_ms, error_message
		 FROM backup_runs ORDER BY started_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var runs []models.BackupRun
	for rows.Next() {
		var r models.BackupRun
		if err := rows.Scan(&r.ID, &r.Status, &r.StartedAt, &r.CompletedAt, &r.TotalRepos,
			&r.Successful, &r.Failed, &r.Skipped, &r.DurationMs, &r.ErrorMessage); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		runs = append(runs, r)
	}

	if runs == nil {
		runs = []models.BackupRun{}
	}
	return c.JSON(runs)
}

func GetBackupRun(c *fiber.Ctx) error {
	id := c.Params("id")

	var r models.BackupRun
	err := db.Pool.QueryRow(context.Background(),
		`SELECT id, status, started_at, completed_at, total_repos, successful, failed, skipped, duration_ms, error_message
		 FROM backup_runs WHERE id = $1`, id).Scan(
		&r.ID, &r.Status, &r.StartedAt, &r.CompletedAt, &r.TotalRepos,
		&r.Successful, &r.Failed, &r.Skipped, &r.DurationMs, &r.ErrorMessage)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "run not found"})
	}

	// Get results for this run
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, run_id, repo_full_name, status, commit_hash, archive_size_bytes, duration_ms, error_message, created_at
		 FROM backup_results WHERE run_id = $1 ORDER BY created_at`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var results []models.BackupResult
	for rows.Next() {
		var br models.BackupResult
		if err := rows.Scan(&br.ID, &br.RunID, &br.RepoFullName, &br.Status, &br.CommitHash,
			&br.ArchiveSizeBytes, &br.DurationMs, &br.ErrorMessage, &br.CreatedAt); err != nil {
			continue
		}
		results = append(results, br)
	}

	if results == nil {
		results = []models.BackupResult{}
	}

	return c.JSON(fiber.Map{"run": r, "results": results})
}

func GetLatestBackup(c *fiber.Ctx) error {
	var r models.BackupRun
	err := db.Pool.QueryRow(context.Background(),
		`SELECT id, status, started_at, completed_at, total_repos, successful, failed, skipped, duration_ms, error_message
		 FROM backup_runs ORDER BY started_at DESC LIMIT 1`).Scan(
		&r.ID, &r.Status, &r.StartedAt, &r.CompletedAt, &r.TotalRepos,
		&r.Successful, &r.Failed, &r.Skipped, &r.DurationMs, &r.ErrorMessage)
	if err != nil {
		return c.JSON(fiber.Map{"run": nil})
	}
	return c.JSON(fiber.Map{"run": r})
}

func GetDashboardStats(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var stats models.DashboardStats

	// Total runs
	db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM backup_runs`).Scan(&stats.TotalRuns)

	// Total successful repositories across completed runs
	db.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(successful), 0) FROM backup_runs WHERE status = 'completed'`).Scan(&stats.TotalSuccessful)

	// Success rate
	var totalRepos, successRepos int
	db.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(total_repos), 0), COALESCE(SUM(successful), 0) FROM backup_runs WHERE status = 'completed'`).Scan(&totalRepos, &successRepos)
	if totalRepos > 0 {
		stats.SuccessRate = float64(successRepos) / float64(totalRepos) * 100
	}
	stats.TotalRepos = totalRepos

	// Total skipped repositories across all runs
	db.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(skipped), 0) FROM backup_runs`).Scan(&stats.TotalSkipped)

	// Last run
	db.Pool.QueryRow(ctx, `SELECT status, started_at FROM backup_runs ORDER BY started_at DESC LIMIT 1`).Scan(&stats.LastRunStatus, &stats.LastRunAt)

	// Total failed
	db.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(failed), 0) FROM backup_runs`).Scan(&stats.TotalFailed)

	// Average duration
	db.Pool.QueryRow(ctx, `SELECT COALESCE(AVG(duration_ms), 0) FROM backup_runs WHERE status = 'completed'`).Scan(&stats.AvgDurationMs)

	// Repository totals from backup_results and execution logs
	db.Pool.QueryRow(ctx, `SELECT COALESCE(COUNT(DISTINCT repo_full_name), 0) FROM backup_results`).Scan(&stats.DistinctRepos)
	db.Pool.QueryRow(ctx, `SELECT COALESCE(COUNT(*), 0) FROM execution_logs`).Scan(&stats.TotalLogs)
	db.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(archive_size_bytes), 0), COALESCE(MAX(archive_size_bytes), 0), COALESCE((SELECT repo_full_name FROM backup_results ORDER BY archive_size_bytes DESC, created_at DESC LIMIT 1), '') FROM backup_results`).Scan(&stats.TotalSizeBytes, &stats.LargestArchiveBytes, &stats.LargestRepository)

	latestAnalytics, _ := loadLatestAnalytics(ctx)
	stats.LatestAnalytics = latestAnalytics

	return c.JSON(stats)
}
