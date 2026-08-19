package db

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/MishraShardendu22/github-backup/backend/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

// This is not a comment this is why migrations work
//
//go:embed schema.sql
var migrationSQL string

var Pool *pgxpool.Pool

// create a connection
func Connect() error {
	cfg := config.Get()
	if cfg == nil || cfg.DatabaseURL == "" {
		return fmt.Errorf("database configuration is not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), config.DBConnectTimeout)
	defer cancel()

	pgxConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("parse postgres url: %w", err)
	}

	pgxConfig.MaxConns = cfg.DBMaxConns
	pgxConfig.MinConns = cfg.DBMinConns
	pgxConfig.MaxConnLifetime = config.DBMaxConnLifetime
	pgxConfig.MaxConnIdleTime = config.DBMaxConnIdleTime

	pool, err := pgxpool.NewWithConfig(ctx, pgxConfig)
	if err != nil {
		return fmt.Errorf("connect to postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping postgres: %w", err)
	}

	Pool = pool
	return nil
}

// close a connection
func Close() {
	if Pool != nil {
		Pool.Close()
	}
}

// run the migrations
func RunMigrations() error {
	ctx, cancel := context.WithTimeout(context.Background(), config.DBMigrationTimeout)
	defer cancel()

	if err := RunVersionedMigrations(ctx, Pool); err != nil {
		return fmt.Errorf("run versioned migrations: %w", err)
	}

	return nil
}
