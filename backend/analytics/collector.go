package analytics

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

const defaultRepoDir = "_Repos"

func Start(ctx context.Context, interval time.Duration) {
	go func() {
		refresh := func() {
			if err := Refresh(ctx); err != nil {
				util.Logger().Warn("Analytics refresh failed", zap.Error(err))
			}
		}

		refresh()

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				refresh()
			}
		}
	}()
}

func Refresh(ctx context.Context) error {
	if db.Pool == nil {
		return fmt.Errorf("postgres pool is not ready")
	}

	repoDir, err := resolveRepoDir()
	if err != nil {
		if strings.Contains(err.Error(), "analytics repo not found") {
			return nil
		}
		return err
	}

	snapshot, err := collectSnapshot(ctx, repoDir)
	if err != nil {
		return err
	}

	currentRunID, err := getCurrentRunID(ctx)
	if err == nil {
		snapshot.RunID = currentRunID
	}

	return persistSnapshot(ctx, snapshot)
}

func resolveRepoDir() (string, error) {
	candidates := []string{
		os.Getenv("BACKUP_REPO_DIR"),
		defaultRepoDir,
		filepath.Join("..", defaultRepoDir),
	}

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if info, err := os.Stat(filepath.Join(candidate, ".git")); err == nil && info.IsDir() {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("analytics repo not found in %v", candidates)
}

func collectSnapshot(ctx context.Context, repoDir string) (*models.RepoAnalyticsSnapshot, error) {
	headCommit, err := runGit(ctx, repoDir, "rev-parse", "HEAD")
	if err != nil {
		return nil, err
	}

	commitMeta, err := runGit(ctx, repoDir, "log", "-1", "--format=%H%x1f%ct%x1f%s")
	if err != nil {
		return nil, err
	}

	metaParts := strings.SplitN(commitMeta, "\x1f", 3)
	if len(metaParts) != 3 {
		return nil, fmt.Errorf("unexpected commit metadata output: %q", commitMeta)
	}

	headCommitAtUnix, err := strconv.ParseInt(strings.TrimSpace(metaParts[1]), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("parse commit timestamp: %w", err)
	}
	headCommitAt := time.Unix(headCommitAtUnix, 0).UTC()

	totalCommits, err := parseIntOutput(ctx, repoDir, "rev-list", "--count", "HEAD")
	if err != nil {
		return nil, err
	}

	branchCount, err := countLines(ctx, repoDir, "for-each-ref", "--format=%(refname:short)", "refs/heads")
	if err != nil {
		return nil, err
	}

	tagCount, err := countLines(ctx, repoDir, "for-each-ref", "--format=%(refname:short)", "refs/tags")
	if err != nil {
		return nil, err
	}

	trackedFiles, totalBlobSize, avgBlobSize, largestBlobPath, largestBlobSize, archiveCount, totalArchiveSize, avgArchiveSize, largestArchivePath, largestArchiveSize, err := collectTreeStats(ctx, repoDir)
	if err != nil {
		return nil, err
	}

	snapshot := &models.RepoAnalyticsSnapshot{
		HeadCommit:              headCommit,
		HeadCommitMessage:       metaParts[2],
		HeadCommitAt:            &headCommitAt,
		TotalCommits:            totalCommits,
		BranchCount:             branchCount,
		TagCount:                tagCount,
		TrackedFiles:            trackedFiles,
		TotalBlobSizeBytes:      totalBlobSize,
		AvgBlobSizeBytes:        avgBlobSize,
		LargestBlobPath:         largestBlobPath,
		LargestBlobSizeBytes:    largestBlobSize,
		ArchiveCount:            archiveCount,
		TotalArchiveSizeBytes:   totalArchiveSize,
		AvgArchiveSizeBytes:     avgArchiveSize,
		LargestArchivePath:      largestArchivePath,
		LargestArchiveSizeBytes: largestArchiveSize,
	}

	return snapshot, nil
}

func collectTreeStats(ctx context.Context, repoDir string) (trackedFiles int, totalBlobSize int64, avgBlobSize int64, largestBlobPath string, largestBlobSize int64, archiveCount int, totalArchiveSize int64, avgArchiveSize int64, largestArchivePath string, largestArchiveSize int64, err error) {
	output, err := runGit(ctx, repoDir, "ls-tree", "-r", "-l", "--full-name", "HEAD")
	if err != nil {
		return 0, 0, 0, "", 0, 0, 0, 0, "", 0, err
	}

	trimmed := strings.TrimSpace(output)
	if trimmed == "" {
		return 0, 0, 0, "", 0, 0, 0, 0, "", 0, nil
	}

	lines := strings.Split(trimmed, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}

		fields := strings.Fields(parts[0])
		if len(fields) < 4 || fields[1] != "blob" {
			continue
		}

		size, parseErr := strconv.ParseInt(fields[3], 10, 64)
		if parseErr != nil {
			continue
		}

		path := parts[1]
		trackedFiles++
		totalBlobSize += size
		if size > largestBlobSize {
			largestBlobSize = size
			largestBlobPath = path
		}

		if strings.HasSuffix(path, ".tar.gz") {
			archiveCount++
			totalArchiveSize += size
			if size > largestArchiveSize {
				largestArchiveSize = size
				largestArchivePath = path
			}
		}
	}

	if trackedFiles > 0 {
		avgBlobSize = totalBlobSize / int64(trackedFiles)
	}
	if archiveCount > 0 {
		avgArchiveSize = totalArchiveSize / int64(archiveCount)
	}

	return trackedFiles, totalBlobSize, avgBlobSize, largestBlobPath, largestBlobSize, archiveCount, totalArchiveSize, avgArchiveSize, largestArchivePath, largestArchiveSize, nil
}

func getCurrentRunID(ctx context.Context) (*int, error) {
	var runID int
	err := db.Pool.QueryRow(ctx, `SELECT id FROM backup_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1`).Scan(&runID)
	if err != nil {
		return nil, err
	}
	return &runID, nil
}

func persistSnapshot(ctx context.Context, snapshot *models.RepoAnalyticsSnapshot) error {
	if snapshot == nil {
		return fmt.Errorf("analytics snapshot is nil")
	}

	query := `
		INSERT INTO analytics_snapshots (
			run_id, head_commit, head_commit_message, head_commit_at,
			total_commits, branch_count, tag_count, tracked_files,
			total_blob_size_bytes, avg_blob_size_bytes, largest_blob_path, largest_blob_size_bytes,
			archive_count, total_archive_size_bytes, avg_archive_size_bytes, largest_archive_path, largest_archive_size_bytes
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8,
			$9, $10, $11, $12,
			$13, $14, $15, $16, $17
		)`

	_, err := db.Pool.Exec(ctx, query,
		snapshot.RunID, snapshot.HeadCommit, snapshot.HeadCommitMessage, snapshot.HeadCommitAt,
		snapshot.TotalCommits, snapshot.BranchCount, snapshot.TagCount, snapshot.TrackedFiles,
		snapshot.TotalBlobSizeBytes, snapshot.AvgBlobSizeBytes, snapshot.LargestBlobPath, snapshot.LargestBlobSizeBytes,
		snapshot.ArchiveCount, snapshot.TotalArchiveSizeBytes, snapshot.AvgArchiveSizeBytes, snapshot.LargestArchivePath, snapshot.LargestArchiveSizeBytes,
	)
	return err
}

func runGit(ctx context.Context, repoDir string, args ...string) (string, error) {
	commandArgs := append([]string{"-C", repoDir}, args...)
	cmd := exec.CommandContext(ctx, "git", commandArgs...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git %s failed: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}
	return strings.TrimSpace(string(output)), nil
}

func parseIntOutput(ctx context.Context, repoDir string, args ...string) (int, error) {
	output, err := runGit(ctx, repoDir, args...)
	if err != nil {
		return 0, err
	}
	value, err := strconv.Atoi(strings.TrimSpace(output))
	if err != nil {
		return 0, fmt.Errorf("parse integer output %q: %w", output, err)
	}
	return value, nil
}

func countLines(ctx context.Context, repoDir string, args ...string) (int, error) {
	output, err := runGit(ctx, repoDir, args...)
	if err != nil {
		return 0, err
	}
	output = strings.TrimSpace(output)
	if output == "" {
		return 0, nil
	}
	return len(strings.Split(output, "\n")), nil
}
