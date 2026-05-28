package handlers

import (
	"context"
	"strconv"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/gofiber/fiber/v2"
)

func GetMetrics(c *fiber.Ctx) error {
	days := c.QueryInt("days", 30)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.FinalizeStaleRunningRuns(ctx, 30*time.Minute); err != nil {
		_ = err
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT id, status, started_at, completed_at, total_repos, successful, failed, skipped, duration_ms
		 FROM backup_runs
		 WHERE started_at >= NOW() - MAKE_INTERVAL(days => $1)
		 ORDER BY started_at`, days)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var runs []models.BackupRun
	for rows.Next() {
		var r models.BackupRun
		if err := rows.Scan(&r.ID, &r.Status, &r.StartedAt, &r.CompletedAt, &r.TotalRepos,
			&r.Successful, &r.Failed, &r.Skipped, &r.DurationMs); err != nil {
			continue
		}
		runs = append(runs, r)
	}

	if runs == nil {
		runs = []models.BackupRun{}
	}

	// Compute trends
	var totalDuration int64
	var totalSuccess, totalFailed, totalSkipped int
	for _, r := range runs {
		totalDuration += r.DurationMs
		totalSuccess += r.Successful
		totalFailed += r.Failed
		totalSkipped += r.Skipped
	}

	avgDuration := int64(0)
	if len(runs) > 0 {
		avgDuration = totalDuration / int64(len(runs))
	}

	var totalSizeBytes int64
	var largestArchiveBytes int64
	var largestRepository string
	var distinctRepos int
	var totalLogs int
	var latestAnalytics *models.RepoAnalyticsSnapshot

	if snapshot, err := loadLatestAnalytics(ctx); err == nil {
		latestAnalytics = snapshot
	}

	db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(archive_size_bytes), 0),
		        COALESCE(MAX(archive_size_bytes), 0),
		        COALESCE((SELECT repo_full_name FROM backup_results ORDER BY archive_size_bytes DESC, created_at DESC LIMIT 1), ''),
		        COALESCE(COUNT(DISTINCT repo_full_name), 0)
	   FROM backup_results`).Scan(&totalSizeBytes, &largestArchiveBytes, &largestRepository, &distinctRepos)
	if totalSizeBytes == 0 {
		_ = db.Pool.QueryRow(ctx,
			`SELECT COALESCE(SUM(total_archive_size_bytes), 0),
		           COALESCE(MAX(largest_archive_size_bytes), 0),
		           COALESCE((SELECT largest_archive_path FROM analytics_snapshots ORDER BY captured_at DESC LIMIT 1), '')
		     FROM analytics_snapshots`).Scan(&totalSizeBytes, &largestArchiveBytes, &largestRepository)
	}

	db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM execution_logs`).Scan(&totalLogs)

	return c.JSON(fiber.Map{
		"runs":                  runs,
		"total_runs":            len(runs),
		"avg_duration_ms":       avgDuration,
		"total_successful":      totalSuccess,
		"total_failed":          totalFailed,
		"total_skipped":         totalSkipped,
		"distinct_repos":        distinctRepos,
		"total_logs":            totalLogs,
		"total_size_bytes":      totalSizeBytes,
		"largest_archive_bytes": largestArchiveBytes,
		"largest_repository":    largestRepository,
		"latest_analytics":      latestAnalytics,
	})
}

func GetLogs(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 100)
	offset := c.QueryInt("offset", 0)
	level := c.Query("level", "")
	runID := c.Query("run_id", "")

	query := `SELECT id, run_id, level, message, repository, created_at FROM execution_logs WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if level != "" {
		query += ` AND level = $` + itoa(argIdx)
		args = append(args, level)
		argIdx++
	}

	if runID != "" {
		query += ` AND run_id = $` + itoa(argIdx)
		args = append(args, runID)
		argIdx++
	}

	query += ` ORDER BY created_at DESC LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var logs []models.ExecutionLog
	for rows.Next() {
		var l models.ExecutionLog
		if err := rows.Scan(&l.ID, &l.RunID, &l.Level, &l.Message, &l.Repository, &l.CreatedAt); err != nil {
			continue
		}
		logs = append(logs, l)
	}

	if logs == nil {
		logs = []models.ExecutionLog{}
	}
	return c.JSON(logs)
}

func itoa(i int) string {
	return strconv.Itoa(i)
}
