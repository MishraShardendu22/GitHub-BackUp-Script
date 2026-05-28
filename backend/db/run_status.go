package db

import (
	"context"
	"database/sql"
	"time"
)

const staleRunningRunThreshold = 30 * time.Minute

func FinalizeStaleRunningRuns(ctx context.Context, threshold time.Duration) (bool, error) {
	if threshold <= 0 {
		threshold = staleRunningRunThreshold
	}

	var runID int
	var startedAt time.Time
	var lastLogAt sql.NullTime

	err := Pool.QueryRow(ctx,
		`SELECT id, started_at
		 FROM backup_runs
		 WHERE status = 'running'
		 ORDER BY started_at DESC
		 LIMIT 1`).Scan(&runID, &startedAt)
	if err != nil {
		return false, nil
	}

	_ = Pool.QueryRow(ctx,
		`SELECT MAX(created_at) FROM execution_logs WHERE run_id = $1`, runID).Scan(&lastLogAt)

	referenceTime := startedAt
	if lastLogAt.Valid && lastLogAt.Time.After(referenceTime) {
		referenceTime = lastLogAt.Time
	}

	if time.Since(referenceTime.UTC()) < threshold {
		return false, nil
	}

	_, err = Pool.Exec(ctx,
		`UPDATE backup_runs
		 SET status = 'completed',
		     completed_at = COALESCE(completed_at, NOW()),
		     duration_ms = CASE
		       WHEN duration_ms > 0 THEN duration_ms
		       ELSE (EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::bigint
		     END,
		     error_message = CASE
		       WHEN error_message IS NULL OR error_message = '' THEN 'Marked completed after stale running state'
		       ELSE error_message
		     END
		 WHERE id = $1`, runID)
	if err != nil {
		return false, err
	}

	return true, nil
}
