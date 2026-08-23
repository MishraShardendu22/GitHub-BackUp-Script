package collect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetLocalAnalytics(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "analytics_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	oldRepoPath := defaultRepoPath
	defaultRepoPath = tempDir
	defer func() { defaultRepoPath = oldRepoPath }()

	// Create mock files
	f1 := filepath.Join(tempDir, "repo1.tar.gz")
	f2 := filepath.Join(tempDir, "repo2.tar.gz")
	f3 := filepath.Join(tempDir, "ignore.txt")

	_ = os.WriteFile(f1, []byte("1234567890"), 0644)           // 10 bytes
	_ = os.WriteFile(f2, []byte("12345678901234567890"), 0644) // 20 bytes
	_ = os.WriteFile(f3, []byte("ignored content"), 0644)

	stats, err := GetLocalAnalytics()
	if err != nil {
		t.Fatalf("GetLocalAnalytics failed: %v", err)
	}

	if stats.TrackedFiles != 2 {
		t.Errorf("expected 2 tracked files, got %d", stats.TrackedFiles)
	}
	if stats.ArchiveCount != 2 {
		t.Errorf("expected 2 archives, got %d", stats.ArchiveCount)
	}
	if stats.TotalBlobSizeBytes != 30 {
		t.Errorf("expected 30 total bytes, got %d", stats.TotalBlobSizeBytes)
	}
	if stats.AvgBlobSizeBytes != 15 {
		t.Errorf("expected 15 avg bytes, got %d", stats.AvgBlobSizeBytes)
	}
	if stats.LargestBlobSizeBytes != 20 {
		t.Errorf("expected largest blob 20 bytes, got %d", stats.LargestBlobSizeBytes)
	}
}
