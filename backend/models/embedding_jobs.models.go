package models

import "time"

// EmbeddingJob represents a unit of embedding work for a single source record.
// Jobs are claimed by workers using FOR UPDATE SKIP LOCKED and processed
// with at-least-once semantics + idempotent UpsertChunk writes.
//
// Field order is intentionally optimized for struct alignment.
type EmbeddingJob struct {
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	ClaimedAt    *time.Time `json:"claimed_at"`
	CompletedAt  *time.Time `json:"completed_at"`

	SourceType   string `json:"source_type"`
	SourceID     string `json:"source_id"`
	ContentHash  string `json:"content_hash"`
	Status       string `json:"status"`
	ErrorMessage string `json:"error_message"`

	ID           int64 `json:"id"`
	GenerationID int   `json:"generation_id"`
	AttemptCount int   `json:"attempt_count"`
	MaxAttempts  int   `json:"max_attempts"`
}

// JobStatus constants for embedding jobs.
const (
	JobStatusPending    = "pending"
	JobStatusProcessing = "processing"
	JobStatusCompleted  = "completed"
	JobStatusFailed     = "failed"
	JobStatusCancelled  = "cancelled"
)

// JobBatchItem is a lightweight struct used for bulk job creation.
type JobBatchItem struct {
	SourceType  string
	SourceID    string
	ContentHash string
}
