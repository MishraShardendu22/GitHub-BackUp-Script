package handlers

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/gofiber/fiber/v2"
)

/*
	GetLogs - gets logs
	GetMetrics - get analytical data to show in frontend, it looks a lot its not
*/

func GetMetrics(c *fiber.Ctx) error {
	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(reqCtx, 10*time.Second)
	defer cancel()

	days := c.QueryInt("days", 30)

	_, _ = db.FinalizeStaleRunningRuns(ctx, 30*time.Minute)

	var (
		runs                []models.BackupRun
		largestRepository   string
		avgDuration         int64
		totalSizeBytes      int64
		largestArchiveBytes int64
		totalRuns           int
		totalSuccess        int
		totalFailed         int
		totalSkipped        int
		distinctRepos       int
		totalLogs           int
		latestAnalytics     *models.RepoAnalyticsSnapshot

		firstErr error
		mu       sync.Mutex
		wg       sync.WaitGroup
	)

	setErr := func(err error) {
		if err == nil {
			return
		}
		mu.Lock()
		if firstErr == nil {
			firstErr = err
		}
		mu.Unlock()
	}

	wg.Add(4)

	// load statistical data from backup_runs
	go func() {
		defer wg.Done()

		rows, err := db.Pool.Query(ctx, `
			SELECT
				id,
				status,
				started_at,
				completed_at,
				total_repos,
				successful,
				failed,
				skipped,
				duration_ms
			FROM backup_runs
			WHERE started_at >= NOW() - MAKE_INTERVAL(days => $1)
			ORDER BY started_at
		`, days)
		if err != nil {
			setErr(err)
			return
		}
		defer rows.Close()

		var localRuns []models.BackupRun

		for rows.Next() {
			var r models.BackupRun

			if err := rows.Scan(
				&r.ID,
				&r.Status,
				&r.StartedAt,
				&r.CompletedAt,
				&r.TotalRepos,
				&r.Successful,
				&r.Failed,
				&r.Skipped,
				&r.DurationMs,
			); err != nil {
				continue
			}

			localRuns = append(localRuns, r)
		}

		if err := rows.Err(); err != nil {
			setErr(err)
			return
		}

		runs = localRuns

		// Note: AVG() returns NUMERIC in PostgreSQL, must cast to BIGINT for int64 scan
		err = db.Pool.QueryRow(ctx, `
			SELECT
				COUNT(*),
				COALESCE(AVG(duration_ms)::BIGINT, 0),
				COALESCE(SUM(successful), 0),
				COALESCE(SUM(failed), 0),
				COALESCE(SUM(skipped), 0)
			FROM backup_runs
			WHERE started_at >= NOW() - MAKE_INTERVAL(days => $1)
		`, days).Scan(
			&totalRuns,
			&avgDuration,
			&totalSuccess,
			&totalFailed,
			&totalSkipped,
		)

		setErr(err)
	}()

	// load statistical data from backup_results
	go func() {
		defer wg.Done()

		err := db.Pool.QueryRow(ctx, `
			SELECT
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
				),
				COALESCE(COUNT(DISTINCT repo_full_name), 0)
			FROM backup_results
		`).Scan(
			&totalSizeBytes,
			&largestArchiveBytes,
			&largestRepository,
			&distinctRepos,
		)

		setErr(err)
	}()

	// load total logs
	go func() {
		defer wg.Done()

		err := db.Pool.QueryRow(
			ctx,
			`SELECT COALESCE(COUNT(*), 0) FROM execution_logs`,
		).Scan(&totalLogs)

		setErr(err)
	}()

	// load latest git analytical data
	go func() {
		defer wg.Done()

		snapshot, err := loadLatestAnalytics(ctx)
		if err == nil {
			latestAnalytics = snapshot
		}
	}()

	wg.Wait()

	if firstErr != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": firstErr.Error(),
		})
	}

	if runs == nil {
		runs = []models.BackupRun{}
	}

	if totalSizeBytes == 0 && latestAnalytics != nil {
		totalSizeBytes = latestAnalytics.TotalArchiveSizeBytes
		largestArchiveBytes = latestAnalytics.LargestArchiveSizeBytes
		largestRepository = latestAnalytics.LargestArchivePath
	}

	return c.JSON(fiber.Map{
		"runs":                  runs,
		"total_runs":            totalRuns,
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
	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}
	limit := c.QueryInt("limit", 50)
	if limit < 1 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}
	offset := (page - 1) * limit
	level := c.Query("level", "")
	runID := c.Query("run_id", "")

	countQuery := `SELECT COUNT(*) FROM execution_logs WHERE 1=1`
	query := `SELECT id, run_id, level, message, repository, created_at FROM execution_logs WHERE 1=1`

	args := []interface{}{}
	argIdx := 1

	if level != "" {
		filter := ` AND level = $` + itoa(argIdx)
		countQuery += filter
		query += filter
		args = append(args, level)
		argIdx++
	}

	if runID != "" {
		filter := ` AND run_id = $` + itoa(argIdx)
		countQuery += filter
		query += filter
		args = append(args, runID)
		argIdx++
	}

	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(reqCtx, 10*time.Second)
	defer cancel()

	var totalItems int
	err := db.Pool.QueryRow(ctx, countQuery, args...).Scan(&totalItems)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	totalPages := totalItems / limit
	if totalItems%limit > 0 {
		totalPages++
	}
	if totalPages == 0 {
		totalPages = 1
	}

	// add pagination to base query
	query += ` ORDER BY created_at DESC LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := db.Pool.Query(ctx, query, args...)
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

	return c.JSON(models.PaginatedResponse{
		Data: logs,
		Pagination: models.PaginationMeta{
			Page:       page,
			Limit:      limit,
			TotalItems: totalItems,
			TotalPages: totalPages,
		},
	})
}

func itoa(i int) string {
	return strconv.Itoa(i)
}
