package monitor

import (
	"context"
	_ "embed"
	"fmt"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/MishraShardendu22/github-backup/backup-worker/config"
	"github.com/MishraShardendu22/github-backup/backup-worker/util"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// already exist so dont need it but adding for safety
//
//go:embed schema.sql
var migrationSQL string

type Monitor struct {
	pool    *pgxpool.Pool
	runID   int
	enabled bool
}

var instance *Monitor

/*
Initialize the monitoring system.

 1. Read PostgreSQL URL
    url := config.LoadConfig().PostgreSql

 2. Connect to PostgreSQL
    pool, err := pgxpool.New(ctx, url)
    - creates a connection pool

 3. Verify connection
    pool.Ping(ctx)
    - check connection (Verify Database Reachability)

 4. Run migrations
    // create migration context and cancel (same as standard as context and cancel)
    migrateCtx, migrateCancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer migrateCancel()

    // run the sql of that specific function
    if _, err := pool.Exec(migrateCtx, migrationSQL); err != nil {
    util.Logger().Warn("Monitor: migration failed (tables may already exist)", zap.Error(err))
    }

 5. Create Monitor singleton
    Making sure the entire application uses the same Monitor object.
*/
func Init() error {
	url := config.LoadConfig().PostgreSql
	if url == "" {
		instance = &Monitor{enabled: false}
		util.Logger().Info("Monitor: DATABASE_URL not set — monitoring disabled")
		return nil
	}

	// create a context with a timeout value (basic) and cancel() releases resources
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		instance = &Monitor{enabled: false}
		return fmt.Errorf("monitor: connect to postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		instance = &Monitor{enabled: false}
		pool.Close()
		return fmt.Errorf("monitor: ping postgres: %w", err)
	}

	migrateCtx, migrateCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer migrateCancel()
	if _, err := pool.Exec(migrateCtx, migrationSQL); err != nil {
		util.Logger().Warn("Monitor: migration failed (tables may already exist)", zap.Error(err))
	}

	instance = &Monitor{pool: pool, enabled: true}
	util.Logger().Info("Monitor: PostgreSQL connected and tables ready")
	return nil
}

// close that instance and connection pool
func Close() {
	if instance != nil && instance.pool != nil {
		instance.pool.Close()
	}
}

// get the instance
func Get() *Monitor {
	return instance
}

// StartRun creates a new backup_run and returns the run ID
func (m *Monitor) StartRun(totalRepos int) {
	if !m.enabled {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err := m.pool.QueryRow(ctx,
		`INSERT INTO backup_runs (status, total_repos) VALUES ('running', $1) RETURNING id`,
		totalRepos).Scan(&m.runID)
	if err != nil {
		util.Logger().Error("Monitor: failed to create backup run", zap.Error(err))
	} else {
		util.Logger().Info("Monitor: backup run started", zap.Int("run_id", m.runID))
	}
}

// Complete Run marks the started run as completed adn the details of that run are filled
func (m *Monitor) CompleteRun(successful, failed, skipped int, durationMs int64, errMsg string) {
	if !m.enabled || m.runID == 0 {
		return
	}
	status := "completed"
	if failed > 0 || errMsg != "" {
		status = "failed"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := m.pool.Exec(ctx,
		`UPDATE backup_runs SET status=$1, completed_at=NOW(), successful=$2, failed=$3, skipped=$4, duration_ms=$5 WHERE id=$6`,
		status, successful, failed, skipped, durationMs, m.runID)
	if err != nil {
		util.Logger().Error("Monitor: failed to complete run", zap.Error(err))
	}
	if errMsg != "" {
		_, _ = m.pool.Exec(ctx,
			`INSERT INTO backup_run_errors (run_id, error_message) VALUES ($1, $2) ON CONFLICT (run_id) DO UPDATE SET error_message = EXCLUDED.error_message`,
			m.runID, errMsg)
	}
}

// this records the final result for one repository.
func (m *Monitor) LogRepoResult(repoFullName, status, commitHash string, archiveSize, durationMs int64, errMsg string) {
	if !m.enabled || m.runID == 0 {
		return
	}
	var commitHashPtr *string
	if commitHash != "" {
		commitHashPtr = &commitHash
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var resultID int
	err := m.pool.QueryRow(ctx,
		`INSERT INTO backup_results (run_id, repo_full_name, status, commit_hash, archive_size_bytes, duration_ms)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		m.runID, repoFullName, status, commitHashPtr, archiveSize, durationMs).Scan(&resultID)
	if err != nil {
		util.Logger().Error("Monitor: failed to log repo result", zap.String("repo", repoFullName), zap.Error(err))
		return
	}

	if errMsg != "" && resultID > 0 {
		_, _ = m.pool.Exec(ctx,
			`INSERT INTO backup_result_errors (result_id, error_message) VALUES ($1, $2)
			 ON CONFLICT (result_id) DO UPDATE SET error_message = EXCLUDED.error_message`,
			resultID, errMsg)
	}
}

// insert logs
func (m *Monitor) Log(level, message, repository string) {
	if !m.enabled {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	var runIDPtr *int
	if m.runID > 0 {
		runIDPtr = &m.runID
	}
	_, err := m.pool.Exec(ctx,
		`INSERT INTO execution_logs (run_id, level, message, repository) VALUES ($1, $2, $3, $4)`,
		runIDPtr, level, message, repository)
	if err != nil {
		util.Logger().Warn("Monitor: failed to write log", zap.Error(err))
	}
}

// update progress
func (m *Monitor) UpdateProgress(successful, failed, skipped int) {
	if !m.enabled || m.runID == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	m.pool.Exec(ctx,
		`UPDATE backup_runs SET successful=$1, failed=$2, skipped=$3 WHERE id=$4`,
		successful, failed, skipped, m.runID)
}

// SaveAnalyticsSnapshot persists one analytics snapshot using the monitor pool.
func (m *Monitor) SaveAnalyticsSnapshot(snapshot *models.RepoAnalyticsSnapshot) error {
	if !m.enabled {
		return nil
	}
	if snapshot == nil {
		return fmt.Errorf("analytics snapshot is nil")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	query := `
		INSERT INTO analytics_snapshots (
			captured_at, run_id, head_commit, head_commit_message, head_commit_at,
			total_commits, branch_count, tag_count, tracked_files,
			total_blob_size_bytes, avg_blob_size_bytes, largest_blob_path, largest_blob_size_bytes,
			archive_count, total_archive_size_bytes, avg_archive_size_bytes, largest_archive_path, largest_archive_size_bytes
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12, $13,
			$14, $15, $16, $17, $18
		)
	`

	var runID any
	if snapshot.RunID != nil {
		runID = *snapshot.RunID
	}

	var headCommitPtr *string
	if snapshot.HeadCommit != "" {
		headCommitPtr = &snapshot.HeadCommit
	}
	var headCommitMsgPtr *string
	if snapshot.HeadCommitMessage != "" {
		headCommitMsgPtr = &snapshot.HeadCommitMessage
	}

	_, err := m.pool.Exec(
		ctx,
		query,
		snapshot.CapturedAt,
		runID,
		headCommitPtr,
		headCommitMsgPtr,
		snapshot.HeadCommitAt,
		snapshot.TotalCommits,
		snapshot.BranchCount,
		snapshot.TagCount,
		snapshot.TrackedFiles,
		snapshot.TotalBlobSizeBytes,
		snapshot.AvgBlobSizeBytes,
		snapshot.LargestBlobPath,
		snapshot.LargestBlobSizeBytes,
		snapshot.ArchiveCount,
		snapshot.TotalArchiveSizeBytes,
		snapshot.AvgArchiveSizeBytes,
		snapshot.LargestArchivePath,
		snapshot.LargestArchiveSizeBytes,
	)
	return err
}

// get the id of the current moniotred isntance
func (m *Monitor) RunID() int {
	return m.runID
}
