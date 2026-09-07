package config

import (
	"os"
	"testing"
)

func TestConfigValidation(t *testing.T) {
	t.Run("fails when DATABASE_URL is missing", func(t *testing.T) {
		os.Unsetenv("POSTGRES_URL")
		os.Unsetenv("DATABASE_URL")
		_, err := LoadAndValidate()
		if err == nil {
			t.Error("expected error when DATABASE_URL is missing")
		}
	})

	t.Run("fails when DATABASE_URL has invalid scheme", func(t *testing.T) {
		os.Setenv("DATABASE_URL", "http://invalid-db-url:5432/db")
		defer os.Unsetenv("DATABASE_URL")
		_, err := LoadAndValidate()
		if err == nil {
			t.Error("expected error for invalid scheme")
		}
	})

	t.Run("fails when SERVER_PORT is out of range", func(t *testing.T) {
		os.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
		os.Setenv("SERVER_PORT", "999999")
		defer os.Unsetenv("DATABASE_URL")
		defer os.Unsetenv("SERVER_PORT")
		_, err := LoadAndValidate()
		if err == nil {
			t.Error("expected error for out of range port")
		}
	})

	t.Run("succeeds with valid configuration and updates singleton", func(t *testing.T) {
		os.Setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
		os.Setenv("SERVER_PORT", "8080")
		os.Setenv("INTERNAL_SECRET", "test-secret")
		os.Setenv("DB_MAX_CONNS", "20")
		os.Setenv("DB_MIN_CONNS", "5")
		defer os.Unsetenv("DATABASE_URL")
		defer os.Unsetenv("SERVER_PORT")
		defer os.Unsetenv("INTERNAL_SECRET")
		defer os.Unsetenv("DB_MAX_CONNS")
		defer os.Unsetenv("DB_MIN_CONNS")

		cfg, err := LoadAndValidate()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cfg.ServerPort != "8080" {
			t.Errorf("expected port 8080, got %s", cfg.ServerPort)
		}
		if cfg.DBMaxConns != 20 || cfg.DBMinConns != 5 {
			t.Errorf("expected max 20 min 5, got max %d min %d", cfg.DBMaxConns, cfg.DBMinConns)
		}
		if Get() != cfg {
			t.Errorf("expected singleton Get() to return the loaded config instance")
		}
	})

	t.Run("succeeds with POSTGRES_URL fallback when DATABASE_URL is missing", func(t *testing.T) {
		os.Unsetenv("DATABASE_URL")
		os.Setenv("POSTGRES_URL", "postgresql://fallback-user:pass@localhost:5432/fallback_db")
		defer os.Unsetenv("POSTGRES_URL")

		cfg, err := LoadAndValidate()
		if err != nil {
			t.Fatalf("unexpected error with POSTGRES_URL fallback: %v", err)
		}
		if cfg.DatabaseURL != "postgresql://fallback-user:pass@localhost:5432/fallback_db" {
			t.Errorf("expected DatabaseURL to be populated from POSTGRES_URL fallback, got %s", cfg.DatabaseURL)
		}
		if cfg.PostgresURL != "postgresql://fallback-user:pass@localhost:5432/fallback_db" {
			t.Errorf("expected PostgresURL to be populated from POSTGRES_URL fallback, got %s", cfg.PostgresURL)
		}
	})
}
