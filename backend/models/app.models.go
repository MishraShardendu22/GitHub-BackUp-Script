package models

import (
	"time"
)

type PaginationMeta struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	TotalItems int `json:"total_items"`
	TotalPages int `json:"total_pages"`
}

type PaginatedResponse struct {
	Data       interface{}    `json:"data"`
	Pagination PaginationMeta `json:"pagination"`
}

type BackupFix struct {
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	CommitHash   string    `json:"commit_hash"`
	Author       string    `json:"author"`
	ID           int       `json:"id"`
	AffectedRuns []int     `json:"affected_runs,omitempty"`
}

type BackupRunFix struct {
	RunID int `json:"run_id"`
	FixID int `json:"fix_id"`
}

type BackupRun struct {
	StartedAt    time.Time   `json:"started_at"`
	Status       string      `json:"status"`
	ErrorMessage string      `json:"error_message"`
	DurationMs   int64       `json:"duration_ms"`
	CompletedAt  *time.Time  `json:"completed_at"`
	ID           int         `json:"id"`
	TotalRepos   int         `json:"total_repos"`
	Successful   int         `json:"successful"`
	Failed       int         `json:"failed"`
	Skipped      int         `json:"skipped"`
	Fixes        []BackupFix `json:"fixes,omitempty"`
}

type BackupResult struct {
	CreatedAt        time.Time `json:"created_at"`
	RepoFullName     string    `json:"repo_full_name"`
	Status           string    `json:"status"`
	CommitHash       string    `json:"commit_hash"`
	ErrorMessage     string    `json:"error_message"`
	ArchiveSizeBytes int64     `json:"archive_size_bytes"`
	DurationMs       int64     `json:"duration_ms"`
	ID               int       `json:"id"`
	RunID            int       `json:"run_id"`
}

type ExecutionLog struct {
	CreatedAt  time.Time `json:"created_at"`
	Level      string    `json:"level"`
	Message    string    `json:"message"`
	Repository string    `json:"repository"`
	RunID      *int      `json:"run_id"`
	ID         int       `json:"id"`
}

type Conversation struct {
	CreatedAt time.Time `json:"created_at"`
	Title     string    `json:"title"`
	ID        int       `json:"id"`
}

type ChatMessage struct {
	CreatedAt      time.Time `json:"created_at"`
	Role           string    `json:"role"`
	Content        string    `json:"content"`
	ID             int       `json:"id"`
	ConversationID int       `json:"conversation_id"`
	TokensUsed     int       `json:"tokens_used"`
	WebSearch      bool      `json:"web_search"`
}

type ReportHistory struct {
	SentAt       time.Time `json:"sent_at"`
	ReportType   string    `json:"report_type"`
	Recipients   string    `json:"recipients"`
	Subject      string    `json:"subject"`
	Status       string    `json:"status"`
	ErrorMessage string    `json:"error_message"`
	ID           int       `json:"id"`
}

type RepoAnalyticsSnapshot struct {
	CapturedAt         time.Time `json:"captured_at"`
	HeadCommit         string    `json:"head_commit"`
	HeadCommitMessage  string    `json:"head_commit_message"`
	LargestArchivePath string    `json:"largest_archive_path"`
	LargestBlobPath    string    `json:"largest_blob_path"`

	TotalBlobSizeBytes      int64 `json:"total_blob_size_bytes"`
	AvgBlobSizeBytes        int64 `json:"avg_blob_size_bytes"`
	LargestBlobSizeBytes    int64 `json:"largest_blob_size_bytes"`
	TotalArchiveSizeBytes   int64 `json:"total_archive_size_bytes"`
	LargestArchiveSizeBytes int64 `json:"largest_archive_size_bytes"`
	AvgArchiveSizeBytes     int64 `json:"avg_archive_size_bytes"`

	HeadCommitAt *time.Time `json:"head_commit_at"`
	RunID        *int       `json:"run_id"`

	ID           int `json:"id"`
	TotalCommits int `json:"total_commits"`
	BranchCount  int `json:"branch_count"`
	TagCount     int `json:"tag_count"`
	TrackedFiles int `json:"tracked_files"`
	ArchiveCount int `json:"archive_count"`
}

type DashboardStats struct {
	LastRunStatus     string `json:"last_run_status"`
	LargestRepository string `json:"largest_repository"`

	LatestAnalytics *RepoAnalyticsSnapshot `json:"latest_analytics"`
	LastRunAt       *time.Time             `json:"last_run_at"`

	AvgDurationMs       int64   `json:"avg_duration_ms"`
	TotalSizeBytes      int64   `json:"total_size_bytes"`
	LargestArchiveBytes int64   `json:"largest_archive_bytes"`
	SuccessRate         float64 `json:"success_rate"`

	TotalFailed     int `json:"total_failed"`
	TotalRuns       int `json:"total_runs"`
	TotalRepos      int `json:"total_repos"`
	TotalSuccessful int `json:"total_successful"`
	TotalSkipped    int `json:"total_skipped"`
	DistinctRepos   int `json:"distinct_repos"`
	TotalLogs       int `json:"total_logs"`
}

type LiveStatus struct {
	CurrentRepo  string     `json:"current_repo"`
	CurrentRunID *int       `json:"current_run_id"`
	StartedAt    *time.Time `json:"started_at"`

	Progress   int `json:"progress"`
	TotalRepos int `json:"total_repos"`

	WorkerRunning bool `json:"worker_running"`
}

/*
Field order is intentionally optimized for struct alignment.

Go preserves field order and does not automatically reorder fields.
Grouping larger fields together reduces compiler-inserted padding,
which can reduce the overall memory footprint of large structs or
large slices of structs.

Common sizes on 64-bit systems:

	time.Time  = 24 bytes
	string     = 16 bytes
	float64    = 8 bytes
	int64      = 8 bytes
	int        = 8 bytes
	*T         = 8 bytes (pointer)
	int32      = 4 bytes
	int16      = 2 bytes
	bool       = 1 byte

Pointers:

	*time.Time // 8 bytes (address only)
	*int       // 8 bytes (address only)

Architecture-dependent types:

	int
	uint
	uintptr

	32-bit => 4 bytes
	64-bit => 8 bytes

	Verify actual struct sizes with:
		unsafe.Sizeof(MyStruct{})
	and field offsets with:
		unsafe.Offsetof(MyStruct{}.Field)
*/
