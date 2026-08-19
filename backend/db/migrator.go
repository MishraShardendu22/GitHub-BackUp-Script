package db

import (
	"context"
	"embed"
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/logger"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

type Migration struct {
	Version int64
	Name    string
	UpSQL   string
	DownSQL string
}

type MigrationStatus struct {
	Version   int64      `json:"version"`
	Name      string     `json:"name"`
	Applied   bool       `json:"applied"`
	AppliedAt *time.Time `json:"applied_at,omitempty"`
}

// LoadMigrations parses all embedded migration files into sorted migration structs.
func LoadMigrations() ([]Migration, error) {
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory: %w", err)
	}

	migrationMap := make(map[int64]*Migration)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		filename := entry.Name()
		if !strings.HasSuffix(filename, ".sql") {
			continue
		}

		parts := strings.Split(filename, "_")
		if len(parts) < 2 {
			continue
		}

		ver, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			continue
		}

		if _, exists := migrationMap[ver]; !exists {
			name := strings.TrimSuffix(strings.Join(parts[1:], "_"), ".up.sql")
			name = strings.TrimSuffix(name, ".down.sql")
			migrationMap[ver] = &Migration{
				Version: ver,
				Name:    name,
			}
		}

		content, err := migrationFS.ReadFile(filepath.Join("migrations", filename))
		if err != nil {
			return nil, fmt.Errorf("failed to read migration file %s: %w", filename, err)
		}

		if strings.HasSuffix(filename, ".up.sql") {
			migrationMap[ver].UpSQL = string(content)
		} else if strings.HasSuffix(filename, ".down.sql") {
			migrationMap[ver].DownSQL = string(content)
		}
	}

	var migrations []Migration
	for _, m := range migrationMap {
		migrations = append(migrations, *m)
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}

// EnsureSchemaMigrationsTable creates the schema_migrations tracking table if it does not exist.
func EnsureSchemaMigrationsTable(ctx context.Context, pool *pgxpool.Pool) error {
	query := `
	CREATE TABLE IF NOT EXISTS schema_migrations (
		version BIGINT PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		dirty BOOLEAN NOT NULL DEFAULT FALSE,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);`
	_, err := pool.Exec(ctx, query)
	return err
}

// RunVersionedMigrations runs all pending up migrations sequentially within isolated transactions.
func RunVersionedMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	if err := EnsureSchemaMigrationsTable(ctx, pool); err != nil {
		return fmt.Errorf("failed to ensure schema_migrations table: %w", err)
	}

	migrations, err := LoadMigrations()
	if err != nil {
		return fmt.Errorf("failed to load migrations: %w", err)
	}

	appliedVersions := make(map[int64]bool)
	rows, err := pool.Query(ctx, "SELECT version, dirty FROM schema_migrations")
	if err != nil {
		return fmt.Errorf("failed to query applied migrations: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var ver int64
		var dirty bool
		if err := rows.Scan(&ver, &dirty); err != nil {
			return fmt.Errorf("failed to scan migration row: %w", err)
		}
		if dirty {
			return fmt.Errorf("database migration %d is in dirty state; manual intervention required", ver)
		}
		appliedVersions[ver] = true
	}

	for _, m := range migrations {
		if appliedVersions[m.Version] {
			continue
		}

		logger.Info(ctx, fmt.Sprintf("Applying migration %06d: %s", m.Version, m.Name))

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("failed to begin tx for migration %d: %w", m.Version, err)
		}

		// Mark dirty = true
		_, err = tx.Exec(ctx, "INSERT INTO schema_migrations (version, name, dirty) VALUES ($1, $2, TRUE)", m.Version, m.Name)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to record dirty migration state: %w", err)
		}

		// Execute up migration SQL
		if _, err := tx.Exec(ctx, m.UpSQL); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to execute migration %d (%s): %w", m.Version, m.Name, err)
		}

		// Mark dirty = false
		_, err = tx.Exec(ctx, "UPDATE schema_migrations SET dirty = FALSE, applied_at = NOW() WHERE version = $1", m.Version)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to clear dirty migration state: %w", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit migration %d: %w", m.Version, err)
		}

		logger.Info(ctx, fmt.Sprintf("Successfully applied migration %06d: %s", m.Version, m.Name))
	}

	return nil
}

// RollbackLatestMigration rolls back the most recent applied migration.
func RollbackLatestMigration(ctx context.Context, pool *pgxpool.Pool) error {
	if err := EnsureSchemaMigrationsTable(ctx, pool); err != nil {
		return err
	}

	var latestVersion int64
	var name string
	err := pool.QueryRow(ctx, "SELECT version, name FROM schema_migrations WHERE dirty = FALSE ORDER BY version DESC LIMIT 1").
		Scan(&latestVersion, &name)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("no applied migrations to rollback")
		}
		return err
	}

	migrations, err := LoadMigrations()
	if err != nil {
		return err
	}

	var targetMigration *Migration
	for _, m := range migrations {
		if m.Version == latestVersion {
			targetMigration = &m
			break
		}
	}

	if targetMigration == nil || targetMigration.DownSQL == "" {
		return fmt.Errorf("no down migration found for version %d", latestVersion)
	}

	logger.Info(ctx, fmt.Sprintf("Rolling back migration %06d: %s", latestVersion, name))

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, targetMigration.DownSQL); err != nil {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("failed to execute rollback SQL: %w", err)
	}

	if _, err := tx.Exec(ctx, "DELETE FROM schema_migrations WHERE version = $1", latestVersion); err != nil {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("failed to remove migration record: %w", err)
	}

	return tx.Commit(ctx)
}
