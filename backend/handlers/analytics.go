package handlers

import (
	"context"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
)

func loadLatestAnalytics(ctx context.Context) (*models.RepoAnalyticsSnapshot, error) {
	var snapshot models.RepoAnalyticsSnapshot
	err := db.Pool.QueryRow(ctx,
		`SELECT id, run_id, captured_at, head_commit, head_commit_message, head_commit_at, total_commits, branch_count, tag_count, tracked_files,
			total_blob_size_bytes, avg_blob_size_bytes, largest_blob_path, largest_blob_size_bytes,
			archive_count, total_archive_size_bytes, avg_archive_size_bytes, largest_archive_path, largest_archive_size_bytes
		 FROM analytics_snapshots ORDER BY captured_at DESC LIMIT 1`).Scan(
		&snapshot.ID, &snapshot.RunID, &snapshot.CapturedAt, &snapshot.HeadCommit, &snapshot.HeadCommitMessage, &snapshot.HeadCommitAt, &snapshot.TotalCommits, &snapshot.BranchCount, &snapshot.TagCount, &snapshot.TrackedFiles,
		&snapshot.TotalBlobSizeBytes, &snapshot.AvgBlobSizeBytes, &snapshot.LargestBlobPath, &snapshot.LargestBlobSizeBytes,
		&snapshot.ArchiveCount, &snapshot.TotalArchiveSizeBytes, &snapshot.AvgArchiveSizeBytes, &snapshot.LargestArchivePath, &snapshot.LargestArchiveSizeBytes,
	)
	if err != nil {
		return nil, nil
	}

	return &snapshot, nil
}
