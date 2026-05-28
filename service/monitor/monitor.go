package monitor

import (
	"context"
	_ "embed"
	"fmt"
	"os"
	"time"

	"github.com/MishraShardendu22/github-backup/util"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

var migrationSQL string

type Monitor struct {
	pool    *pgxpool.Pool
	runID   int
	enabled bool
}

var instance *Monitor

func Init() error {
	url := os.Getenv("POSTGRES_URL")
	if url == "" {
		instance = &Monitor{enabled: false}
		util.Logger().Info("Monitor: POSTGRES_URL not set — monitoring disabled")
		return nil
	}

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

func Close() {
	if instance != nil && instance.pool != nil {
		instance.pool.Close()
	}
}

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

func (m *Monitor) CompleteRun(successful, failed, skipped int, durationMs int64, errMsg string) {
	if !m.enabled || m.runID == 0 {
		return
	}
	status := "completed"
	if errMsg != "" {
		status = "failed"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := m.pool.Exec(ctx,
		`UPDATE backup_runs SET status=$1, completed_at=NOW(), successful=$2, failed=$3, skipped=$4, duration_ms=$5, error_message=$6 WHERE id=$7`,
		status, successful, failed, skipped, durationMs, errMsg, m.runID)
	if err != nil {
		util.Logger().Error("Monitor: failed to complete run", zap.Error(err))
	}
}

func (m *Monitor) LogRepoResult(repoFullName, status, commitHash string, archiveSize, durationMs int64, errMsg string) {
	if !m.enabled || m.runID == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := m.pool.Exec(ctx,
		`INSERT INTO backup_results (run_id, repo_full_name, status, commit_hash, archive_size_bytes, duration_ms, error_message)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		m.runID, repoFullName, status, commitHash, archiveSize, durationMs, errMsg)
	if err != nil {
		util.Logger().Error("Monitor: failed to log repo result", zap.String("repo", repoFullName), zap.Error(err))
	}
}

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
