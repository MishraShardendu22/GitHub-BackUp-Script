package db

import (
	"context"
	_ "embed"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var migrationSQL string

var Pool *pgxpool.Pool

func Connect() error {
	url := os.Getenv("POSTGRES_URL")
	if url == "" {
		return fmt.Errorf("POSTGRES_URL not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		return fmt.Errorf("parse postgres url: %w", err)
	}

	config.MaxConns = 10
	config.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("connect to postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping postgres: %w", err)
	}

	Pool = pool
	return nil
}

func Close() {
	if Pool != nil {
		Pool.Close()
	}
}

func RunMigrations() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err := Pool.Exec(ctx, migrationSQL)
	if err != nil {
		return fmt.Errorf("run migration: %w", err)
	}

	return nil
}
