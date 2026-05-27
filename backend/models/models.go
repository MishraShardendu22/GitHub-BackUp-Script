package models

import "time"

type BackupRun struct {
	ID           int        `json:"id"`
	Status       string     `json:"status"`
	StartedAt    time.Time  `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at"`
	TotalRepos   int        `json:"total_repos"`
	Successful   int        `json:"successful"`
	Failed       int        `json:"failed"`
	Skipped      int        `json:"skipped"`
	DurationMs   int64      `json:"duration_ms"`
	ErrorMessage string     `json:"error_message"`
}

type BackupResult struct {
	ID               int       `json:"id"`
	RunID            int       `json:"run_id"`
	RepoFullName     string    `json:"repo_full_name"`
	Status           string    `json:"status"`
	CommitHash       string    `json:"commit_hash"`
	ArchiveSizeBytes int64     `json:"archive_size_bytes"`
	DurationMs       int64     `json:"duration_ms"`
	ErrorMessage     string    `json:"error_message"`
	CreatedAt        time.Time `json:"created_at"`
}

type ExecutionLog struct {
	ID         int       `json:"id"`
	RunID      *int      `json:"run_id"`
	Level      string    `json:"level"`
	Message    string    `json:"message"`
	Repository string    `json:"repository"`
	CreatedAt  time.Time `json:"created_at"`
}

type Conversation struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
}

type ChatMessage struct {
	ID             int       `json:"id"`
	ConversationID int       `json:"conversation_id"`
	Role           string    `json:"role"`
	Content        string    `json:"content"`
	TokensUsed     int       `json:"tokens_used"`
	WebSearch      bool      `json:"web_search"`
	CreatedAt      time.Time `json:"created_at"`
}

type ReportHistory struct {
	ID           int       `json:"id"`
	ReportType   string    `json:"report_type"`
	Recipients   string    `json:"recipients"`
	Subject      string    `json:"subject"`
	Status       string    `json:"status"`
	ErrorMessage string    `json:"error_message"`
	SentAt       time.Time `json:"sent_at"`
}

// API response types
type DashboardStats struct {
	TotalRuns      int     `json:"total_runs"`
	TotalRepos     int     `json:"total_repos"`
	SuccessRate    float64 `json:"success_rate"`
	LastRunStatus  string  `json:"last_run_status"`
	LastRunAt      *time.Time `json:"last_run_at"`
	TotalFailed    int     `json:"total_failed"`
	AvgDurationMs  int64   `json:"avg_duration_ms"`
}

type LiveStatus struct {
	WorkerRunning bool       `json:"worker_running"`
	CurrentRunID  *int       `json:"current_run_id"`
	Progress      int        `json:"progress"`
	TotalRepos    int        `json:"total_repos"`
	CurrentRepo   string     `json:"current_repo"`
	StartedAt     *time.Time `json:"started_at"`
}
