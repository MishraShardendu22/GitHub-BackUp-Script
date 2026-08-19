package handlers

import (
	"context"
	"strconv"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/gofiber/fiber/v2"
)

func GetAnalyticsRuns(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}
	limit := c.QueryInt("limit", 50)
	if limit < 1 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}
	offset := (page - 1) * limit

	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(reqCtx, 15*time.Second)
	defer cancel()

	var totalItems int
	err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM analytics_snapshots").Scan(&totalItems)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	totalPages := totalItems / limit
	if totalItems%limit > 0 {
		totalPages++
	}
	if totalPages == 0 {
		totalPages = 1
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT run_id AS id, run_id, captured_at, head_commit, head_commit_message, head_commit_at, total_commits, branch_count, tag_count, tracked_files, total_blob_size_bytes, avg_blob_size_bytes, largest_blob_path, largest_blob_size_bytes, archive_count, total_archive_size_bytes, avg_archive_size_bytes, largest_archive_path, largest_archive_size_bytes
		FROM analytics_snapshots
		ORDER BY captured_at DESC
		LIMIT $1 OFFSET $2
		`,
		limit, offset,
	)

	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	var snapshots []models.RepoAnalyticsSnapshot

	for rows.Next() {
		var snapshot models.RepoAnalyticsSnapshot

		err := rows.Scan(&snapshot.ID, &snapshot.RunID, &snapshot.CapturedAt, &snapshot.HeadCommit, &snapshot.HeadCommitMessage, &snapshot.HeadCommitAt, &snapshot.TotalCommits, &snapshot.BranchCount, &snapshot.TagCount, &snapshot.TrackedFiles, &snapshot.TotalBlobSizeBytes, &snapshot.AvgBlobSizeBytes, &snapshot.LargestBlobPath, &snapshot.LargestBlobSizeBytes, &snapshot.ArchiveCount, &snapshot.TotalArchiveSizeBytes, &snapshot.AvgArchiveSizeBytes, &snapshot.LargestArchivePath, &snapshot.LargestArchiveSizeBytes)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}

		snapshots = append(snapshots, snapshot)
	}

	if snapshots == nil {
		snapshots = []models.RepoAnalyticsSnapshot{}
	}

	return c.JSON(models.PaginatedResponse{
		Data: snapshots,
		Pagination: models.PaginationMeta{
			Page:       page,
			Limit:      limit,
			TotalItems: totalItems,
			TotalPages: totalPages,
		},
	})
}

func GetAnalyticsForLatestRun(c *fiber.Ctx) error {
	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(reqCtx, 10*time.Second)
	defer cancel()

	var snapshot models.RepoAnalyticsSnapshot

	err := db.Pool.QueryRow(
		ctx,
		`
		SELECT run_id AS id, run_id, captured_at, head_commit, head_commit_message, head_commit_at, total_commits, branch_count, tag_count, tracked_files, total_blob_size_bytes, avg_blob_size_bytes, largest_blob_path, largest_blob_size_bytes, archive_count, total_archive_size_bytes, avg_archive_size_bytes, largest_archive_path, largest_archive_size_bytes
		FROM analytics_snapshots
		ORDER BY captured_at DESC
		LIMIT 1
		`,
	).Scan(&snapshot.ID, &snapshot.RunID, &snapshot.CapturedAt, &snapshot.HeadCommit, &snapshot.HeadCommitMessage, &snapshot.HeadCommitAt, &snapshot.TotalCommits, &snapshot.BranchCount, &snapshot.TagCount, &snapshot.TrackedFiles, &snapshot.TotalBlobSizeBytes, &snapshot.AvgBlobSizeBytes, &snapshot.LargestBlobPath, &snapshot.LargestBlobSizeBytes, &snapshot.ArchiveCount, &snapshot.TotalArchiveSizeBytes, &snapshot.AvgArchiveSizeBytes, &snapshot.LargestArchivePath, &snapshot.LargestArchiveSizeBytes)

	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "analytics not found")
	}

	return c.JSON(snapshot)
}

func GetAnalyticsForSpecificRun(c *fiber.Ctx) error {
	runID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid run id")
	}

	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(reqCtx, 10*time.Second)
	defer cancel()

	var snapshot models.RepoAnalyticsSnapshot

	err = db.Pool.QueryRow(
		ctx,
		`
		SELECT run_id AS id, run_id, captured_at, head_commit, head_commit_message, head_commit_at, total_commits, branch_count, tag_count, tracked_files, total_blob_size_bytes, avg_blob_size_bytes, largest_blob_path, largest_blob_size_bytes, archive_count, total_archive_size_bytes, avg_archive_size_bytes, largest_archive_path, largest_archive_size_bytes
		FROM analytics_snapshots
		WHERE run_id = $1
		LIMIT 1
		`,
		runID,
	).Scan(&snapshot.ID, &snapshot.RunID, &snapshot.CapturedAt, &snapshot.HeadCommit, &snapshot.HeadCommitMessage, &snapshot.HeadCommitAt, &snapshot.TotalCommits, &snapshot.BranchCount, &snapshot.TagCount, &snapshot.TrackedFiles, &snapshot.TotalBlobSizeBytes, &snapshot.AvgBlobSizeBytes, &snapshot.LargestBlobPath, &snapshot.LargestBlobSizeBytes, &snapshot.ArchiveCount, &snapshot.TotalArchiveSizeBytes, &snapshot.AvgArchiveSizeBytes, &snapshot.LargestArchivePath, &snapshot.LargestArchiveSizeBytes)

	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "analytics not found")
	}

	return c.JSON(snapshot)
}
