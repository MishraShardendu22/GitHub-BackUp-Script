package db

import (
	"testing"
)

func TestLoadMigrations(t *testing.T) {
	migrations, err := LoadMigrations()
	if err != nil {
		t.Fatalf("LoadMigrations() returned error: %v", err)
	}

	if len(migrations) == 0 {
		t.Fatalf("expected at least 1 migration, got 0")
	}

	// Verify migrations are sorted by version ascending
	for i := 1; i < len(migrations); i++ {
		if migrations[i].Version <= migrations[i-1].Version {
			t.Errorf("migrations not sorted: version %d comes after %d", migrations[i].Version, migrations[i-1].Version)
		}
	}

	// Verify first migration has UpSQL
	if migrations[0].Version != 1 {
		t.Errorf("expected first migration to be version 1, got %d", migrations[0].Version)
	}

	if len(migrations[0].UpSQL) == 0 {
		t.Errorf("migration 1 has empty UpSQL")
	}

	if len(migrations[0].DownSQL) == 0 {
		t.Errorf("migration 1 has empty DownSQL")
	}
}
