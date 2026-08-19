package db

import (
	"context"
	"database/sql"
	"time"
)

const staleRunningRunThreshold = 30 * time.Minute

// If a run is marked running but hasn't shown any sign of life for 30+ minutes,
// assume the process died and clean up the database record.
func FinalizeStaleRunningRuns(ctx context.Context, threshold time.Duration) (bool, error) {
	if threshold <= 0 {
		threshold = staleRunningRunThreshold
	}

	var runID int
	var startedAt time.Time
	var lastLogAt sql.NullTime

	// select id and started time of runs that are "running"
	err := Pool.QueryRow(ctx,
		`SELECT id, started_at
		 FROM backup_runs
		 WHERE status = 'running'
		 ORDER BY started_at DESC
		 LIMIT 1`).Scan(&runID, &startedAt)
	if err != nil {
		return false, nil
	}

	// looks for the newest log entry associated with that run.
	_ = Pool.QueryRow(ctx,
		`SELECT MAX(created_at) FROM execution_logs WHERE run_id = $1`, runID).Scan(&lastLogAt)

	// check if last log time is vald and after started at time
	referenceTime := startedAt
	if lastLogAt.Valid && lastLogAt.Time.After(referenceTime) {
		referenceTime = lastLogAt.Time
	}

	// checks if stale
	if time.Since(referenceTime.UTC()) < threshold {
		return false, nil
	}

	/*
		COALESCE() returns the first non-NULL value from a list of expressions.
		SELECT COALESCE(NULL, NULL, 'Hello', 'World'); return Hello

		If completed_at already has a value keep it, else mark it as NOW()
		completed_at = COALESCE(completed_at, NOW()),

		If duration is already recorded keep it else mar it as the calculated value
		duration_ms = CASE
			WHEN duration_ms > 0 THEN duration_ms
			ELSE calculated_duration
		END

		// calculation done like this
		NOW() => Returns the current timestamp.
		NOW() - started_at => Calculates the time difference between the current time and started_at. (5min 12.35sec)
		EXTRACT(EPOCH FROM (...)) => Converts the interval into total seconds. (312.35 sec)
		* 1000 => converts to milisec
		::bigint => cast to big int
	*/
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
