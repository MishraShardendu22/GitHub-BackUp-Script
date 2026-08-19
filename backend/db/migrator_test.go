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

	if len(migrations) < 5 {
		t.Errorf("expected at least 5 migrations, got %d", len(migrations))
	}

	// Verify each migration has non-empty UpSQL and DownSQL
	for _, m := range migrations {
		if len(m.UpSQL) == 0 {
			t.Errorf("migration %d (%s) has empty UpSQL", m.Version, m.Name)
		}
		if len(m.DownSQL) == 0 {
			t.Errorf("migration %d (%s) has empty DownSQL", m.Version, m.Name)
		}
	}
}
