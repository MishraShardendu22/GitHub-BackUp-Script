package db

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/models"
)

// ClaimJobs atomically claims a batch of pending/retryable jobs.
// Updates status to 'processing', increments attempt_count, sets claimed_at=NOW().
func ClaimJobs(ctx context.Context, generationID int, batchSize int) ([]models.EmbeddingJob, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		UPDATE embedding_jobs
		SET status = 'processing',
		    attempt_count = attempt_count + 1,
		    claimed_at = NOW(),
		    updated_at = NOW()
		WHERE id IN (
			SELECT id FROM embedding_jobs
			WHERE generation_id = $1 
			  AND (status = 'pending' OR (status = 'failed' AND attempt_count < max_attempts))
			ORDER BY id
			LIMIT $2
			FOR UPDATE SKIP LOCKED
		)
		RETURNING id, generation_id, source_type, source_id, content_hash, status, attempt_count, max_attempts, claimed_at, completed_at, created_at, updated_at
	`

	rows, err := Pool.Query(ctx, query, generationID, batchSize)
	if err != nil {
		log.Printf("Error claiming jobs for generation %d: %v\n", generationID, err)
		return nil, fmt.Errorf("failed to claim jobs: %w", err)
	}
	defer rows.Close()

	var jobs []models.EmbeddingJob
	for rows.Next() {
		var j models.EmbeddingJob
		err := rows.Scan(
			&j.ID,
			&j.GenerationID,
			&j.SourceType,
			&j.SourceID,
			&j.ContentHash,
			&j.Status,
			&j.AttemptCount,
			&j.MaxAttempts,
			&j.ClaimedAt,
			&j.CompletedAt,
			&j.CreatedAt,
			&j.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan claimed job: %w", err)
		}
		jobs = append(jobs, j)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating claimed jobs: %w", err)
	}

	return jobs, nil
}

// MarkJobCompleted marks a job as successfully completed.
func MarkJobCompleted(ctx context.Context, jobID int64) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		UPDATE embedding_jobs
		SET status = 'completed',
		    completed_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1
	`

	_, err := Pool.Exec(ctx, query, jobID)
	if err != nil {
		log.Printf("Error marking job %d as completed: %v\n", jobID, err)
		return fmt.Errorf("failed to mark job as completed: %w", err)
	}
	_, _ = Pool.Exec(ctx, `DELETE FROM embedding_job_errors WHERE job_id = $1`, jobID)

	return nil
}

// MarkJobFailed marks a job as failed and updates the error message.
func MarkJobFailed(ctx context.Context, jobID int64, errMsg string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		UPDATE embedding_jobs
		SET status = 'failed',
		    updated_at = NOW()
		WHERE id = $1
	`

	_, err := Pool.Exec(ctx, query, jobID)
	if err != nil {
		log.Printf("Error marking job %d as failed: %v\n", jobID, err)
		return fmt.Errorf("failed to mark job as failed: %w", err)
	}

	if errMsg != "" {
		_, _ = Pool.Exec(ctx,
			`INSERT INTO embedding_job_errors (job_id, error_message) VALUES ($1, $2)
			 ON CONFLICT (job_id) DO UPDATE SET error_message = EXCLUDED.error_message`,
			jobID, errMsg)
	}

	return nil
}

// ReclaimStaleJobs finds jobs stuck in 'processing' and resets them to 'pending'.
func ReclaimStaleJobs(ctx context.Context, staleThreshold time.Duration) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	staleTime := time.Now().Add(-staleThreshold)

	query := `
		UPDATE embedding_jobs
		SET status = 'pending',
		    claimed_at = NULL,
		    updated_at = NOW()
		WHERE status = 'processing' AND claimed_at < $1
	`

	cmdTag, err := Pool.Exec(ctx, query, staleTime)
	if err != nil {
		log.Printf("Error reclaiming stale jobs: %v\n", err)
		return 0, fmt.Errorf("failed to reclaim stale jobs: %w", err)
	}

	return cmdTag.RowsAffected(), nil
}

// CreateJob inserts a new embedding job. Ignores duplicates.
func CreateJob(ctx context.Context, generationID int, sourceType, sourceID, contentHash string) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		INSERT INTO embedding_jobs (generation_id, source_type, source_id, content_hash)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (generation_id, source_type, source_id) DO NOTHING
		RETURNING id
	`

	var id int64
	err := Pool.QueryRow(ctx, query, generationID, sourceType, sourceID, contentHash).Scan(&id)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return 0, nil
		}
		log.Printf("Error creating job for generation %d: %v\n", generationID, err)
		return 0, fmt.Errorf("failed to create job: %w", err)
	}

	return id, nil
}

// CreateJobsBatch inserts multiple jobs in a single query.
func CreateJobsBatch(ctx context.Context, generationID int, jobs []struct{ SourceType, SourceID, ContentHash string }) (int64, error) {
	if len(jobs) == 0 {
		return 0, nil
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var valueStrings []string
	var valueArgs []interface{}

	valueArgs = append(valueArgs, generationID)
	argIndex := 2

	for _, job := range jobs {
		valueStrings = append(valueStrings, fmt.Sprintf("($1, $%d, $%d, $%d)", argIndex, argIndex+1, argIndex+2))
		valueArgs = append(valueArgs, job.SourceType, job.SourceID, job.ContentHash)
		argIndex += 3
	}

	query := fmt.Sprintf(`
		INSERT INTO embedding_jobs (generation_id, source_type, source_id, content_hash)
		VALUES %s
		ON CONFLICT (generation_id, source_type, source_id) DO NOTHING
	`, strings.Join(valueStrings, ","))

	cmdTag, err := Pool.Exec(ctx, query, valueArgs...)
	if err != nil {
		log.Printf("Error batch creating jobs for generation %d: %v\n", generationID, err)
		return 0, fmt.Errorf("failed to batch create jobs: %w", err)
	}

	return cmdTag.RowsAffected(), nil
}

// CountJobsByStatus returns a map of status to count for a given generation.
func CountJobsByStatus(ctx context.Context, generationID int) (map[string]int, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		SELECT status, COUNT(*)
		FROM embedding_jobs
		WHERE generation_id = $1
		GROUP BY status
	`

	rows, err := Pool.Query(ctx, query, generationID)
	if err != nil {
		log.Printf("Error counting jobs for generation %d: %v\n", generationID, err)
		return nil, fmt.Errorf("failed to count jobs by status: %w", err)
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, fmt.Errorf("failed to scan job count: %w", err)
		}
		counts[status] = count
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating job counts: %w", err)
	}

	return counts, nil
}

// CancelJobsForGeneration cancels all pending or failed jobs for a generation.
func CancelJobsForGeneration(ctx context.Context, generationID int) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		UPDATE embedding_jobs
		SET status = 'cancelled',
		    updated_at = NOW()
		WHERE generation_id = $1 AND status IN ('pending', 'failed')
	`

	cmdTag, err := Pool.Exec(ctx, query, generationID)
	if err != nil {
		log.Printf("Error cancelling jobs for generation %d: %v\n", generationID, err)
		return 0, fmt.Errorf("failed to cancel jobs: %w", err)
	}

	return cmdTag.RowsAffected(), nil
}
