package database

import (
	"database/sql"
	"errors"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open sqlite in-memory db: %v", err)
	}

	if err := InitSchema(db); err != nil {
		t.Fatalf("failed to init schema: %v", err)
	}

	return db
}

func TestSQLiteOperations(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// 1. Test UpsertRepo
	err := UpsertRepo(db, "repo1", "org/repo1", "https://github.com/org/repo1.git", "hash123")
	if err != nil {
		t.Fatalf("UpsertRepo failed: %v", err)
	}

	// 2. Test GetRepo
	record, found, err := GetRepo(db, "org/repo1")
	if err != nil {
		t.Fatalf("GetRepo failed: %v", err)
	}
	if !found {
		t.Fatalf("expected repo to be found")
	}
	if record.LatestCommitHash != "hash123" {
		t.Errorf("expected hash123, got %s", record.LatestCommitHash)
	}

	// 3. Test GetAllReposFromDB
	repos, err := GetAllReposFromDB(db)
	if err != nil {
		t.Fatalf("GetAllReposFromDB failed: %v", err)
	}
	if len(repos) != 1 {
		t.Errorf("expected 1 repo, got %d", len(repos))
	}

	// 4. Test LogFailure
	err = LogFailure(db, "org/repo1", errors.New("network timeout"))
	if err != nil {
		t.Fatalf("LogFailure failed: %v", err)
	}

	// 5. Test GetRepoStats
	stats, err := GetRepoStats(db)
	if err != nil {
		t.Fatalf("GetRepoStats failed: %v", err)
	}
	if stats.TotalRepos != 1 {
		t.Errorf("expected 1 total repo, got %d", stats.TotalRepos)
	}
	if stats.FailedRepos != 1 {
		t.Errorf("expected 1 failed repo, got %d", stats.FailedRepos)
	}

	// 6. Test DeleteRepo
	err = DeleteRepo(db, "org/repo1")
	if err != nil {
		t.Fatalf("DeleteRepo failed: %v", err)
	}

	_, foundAfterDelete, _ := GetRepo(db, "org/repo1")
	if foundAfterDelete {
		t.Errorf("expected repo to be deleted")
	}
}
