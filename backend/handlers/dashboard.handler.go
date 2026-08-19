package handlers

import (
	"context"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/gofiber/fiber/v2"
)

/*
GetDashboardStats() is a dashboard aggregation handler.

If everything doesn't finish within 15 seconds, cancel all database operations.
ctx, cancel := context.WithTimeout(

	context.Background(),
	15*time.Second,

)
defer cancel()
*/
func GetDashboardStats(c *fiber.Ctx) error {
	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(reqCtx, 15*time.Second)
	defer cancel()

	_, _ = db.FinalizeStaleRunningRuns(ctx, 30*time.Minute)

	var stats models.DashboardStats
	var totalSuccess, totalFailed, totalSkipped int

	// Query to fill values of stats and total repo data
	// Note: AVG() returns NUMERIC in PostgreSQL, must cast to BIGINT for int64 scan
	err := db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COALESCE(SUM(successful), 0),
			COALESCE(SUM(failed), 0),
			COALESCE(SUM(skipped), 0),
			COALESCE(SUM(total_repos), 0),
			COALESCE(AVG(NULLIF(duration_ms, 0))::BIGINT, 0)
		FROM backup_runs
	`).Scan(
		&stats.TotalRuns,
		&totalSuccess,
		&totalFailed,
		&totalSkipped,
		&stats.TotalRepos,
		&stats.AvgDurationMs,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	stats.TotalSuccessful = totalSuccess
	stats.TotalFailed = totalFailed
	stats.TotalSkipped = totalSkipped

	// Query to get average duration of runs
	// Note: AVG() returns NUMERIC in PostgreSQL, must cast to BIGINT for int64 scan
	if stats.AvgDurationMs == 0 {
		_ = db.Pool.QueryRow(ctx, `SELECT COALESCE(AVG(duration_ms)::BIGINT, 0) FROM backup_runs`).Scan(&stats.AvgDurationMs)
	}

	// Query to get status of last run
	_ = db.Pool.QueryRow(
		ctx,
		`SELECT status, started_at
		 FROM backup_runs
		 ORDER BY started_at DESC
		 LIMIT 1`,
	).Scan(&stats.LastRunStatus, &stats.LastRunAt)

	// query to get stats from backup results table
	err = db.Pool.QueryRow(ctx, `
		SELECT
			COALESCE(COUNT(DISTINCT repo_full_name), 0),
			COALESCE(SUM(archive_size_bytes), 0),
			COALESCE(MAX(archive_size_bytes), 0),
			COALESCE(
				(
					SELECT repo_full_name
					FROM backup_results
					ORDER BY archive_size_bytes DESC, created_at DESC
					LIMIT 1
				),
				''
			)
		FROM backup_results
	`).Scan(
		&stats.DistinctRepos,
		&stats.TotalSizeBytes,
		&stats.LargestArchiveBytes,
		&stats.LargestRepository,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	// query to get total logs
	err = db.Pool.QueryRow(
		ctx,
		`SELECT COALESCE(COUNT(*), 0) FROM execution_logs`,
	).Scan(&stats.TotalLogs)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	latestAnalytics, _ := loadLatestAnalytics(ctx)
	stats.LatestAnalytics = latestAnalytics

	if stats.DistinctRepos == 0 && latestAnalytics != nil {
		stats.DistinctRepos = latestAnalytics.TrackedFiles
	}

	if stats.TotalSizeBytes == 0 && latestAnalytics != nil {
		stats.TotalSizeBytes = latestAnalytics.TotalArchiveSizeBytes
		stats.LargestArchiveBytes = latestAnalytics.LargestArchiveSizeBytes
		stats.LargestRepository = latestAnalytics.LargestArchivePath
	}

	if stats.TotalRepos > 0 {
		stats.SuccessRate = 100.0 - (float64(totalFailed) / float64(stats.TotalRepos) * 100.0)
	}

	return c.JSON(stats)
}

// loads the git snapshot data (loads using analytics/collector.analytics.go)
// going to the latest snapshot and loading the latest data
func loadLatestAnalytics(ctx context.Context) (*models.RepoAnalyticsSnapshot, error) {
	var snapshot models.RepoAnalyticsSnapshot
	err := db.Pool.QueryRow(ctx,
		`SELECT run_id AS id, run_id, captured_at, head_commit, head_commit_message, head_commit_at, total_commits, branch_count, tag_count, tracked_files,
		total_blob_size_bytes, avg_blob_size_bytes, largest_blob_path, largest_blob_size_bytes,
		archive_count, total_archive_size_bytes, avg_archive_size_bytes, largest_archive_path, largest_archive_size_bytes
		FROM analytics_snapshots ORDER BY captured_at DESC LIMIT 1`).Scan(
		&snapshot.ID, &snapshot.RunID, &snapshot.CapturedAt, &snapshot.HeadCommit, &snapshot.HeadCommitMessage, &snapshot.HeadCommitAt, &snapshot.TotalCommits, &snapshot.BranchCount, &snapshot.TagCount, &snapshot.TrackedFiles,
		&snapshot.TotalBlobSizeBytes, &snapshot.AvgBlobSizeBytes, &snapshot.LargestBlobPath, &snapshot.LargestBlobSizeBytes,
		&snapshot.ArchiveCount, &snapshot.TotalArchiveSizeBytes, &snapshot.AvgArchiveSizeBytes, &snapshot.LargestArchivePath, &snapshot.LargestArchiveSizeBytes,
	)
	if err != nil {
		return nil, nil
	}

	return &snapshot, nil
}
