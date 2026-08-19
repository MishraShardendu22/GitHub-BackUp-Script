package handlers

import (
	"context"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/gofiber/fiber/v2"
)

func GetRepos(c *fiber.Ctx) error {
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
	ctx, cancel := context.WithTimeout(reqCtx, 20*time.Second)
	defer cancel()

	var totalItems int
	err := db.Pool.QueryRow(ctx, "SELECT COUNT(DISTINCT repo_full_name) FROM backup_results").Scan(&totalItems)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	totalPages := totalItems / limit
	if totalItems%limit > 0 {
		totalPages++
	}
	if totalPages == 0 {
		totalPages = 1
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT repo_full_name, status, commit_hash, archive_size_bytes, created_at
		 FROM (
		     SELECT DISTINCT ON (repo_full_name)
		         repo_full_name, status, commit_hash, archive_size_bytes, created_at
		     FROM backup_results
		     ORDER BY repo_full_name, archive_size_bytes DESC, created_at DESC
		 ) ranked_repos
		 ORDER BY archive_size_bytes DESC, created_at DESC
		 LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type RepoInfo struct {
		FullName         string `json:"full_name"`
		LastStatus       string `json:"last_status"`
		LastCommitHash   string `json:"last_commit_hash"`
		ArchiveSizeBytes int64  `json:"archive_size_bytes"`
		LastBackedUp     string `json:"last_backed_up"`
	}

	var repos []RepoInfo
	for rows.Next() {
		var r RepoInfo
		var createdAt interface{}
		if err := rows.Scan(&r.FullName, &r.LastStatus, &r.LastCommitHash, &r.ArchiveSizeBytes, &createdAt); err != nil {
			continue
		}
		if t, ok := createdAt.(interface{ String() string }); ok {
			r.LastBackedUp = t.String()
		}
		repos = append(repos, r)
	}

	if repos == nil {
		repos = []RepoInfo{}
	}

	return c.JSON(models.PaginatedResponse{
		Data: repos,
		Pagination: models.PaginationMeta{
			Page:       page,
			Limit:      limit,
			TotalItems: totalItems,
			TotalPages: totalPages,
		},
	})
}

/*
Purpose of the query

1. DISTINCT ON (repo_full_name) keeps only one row per repository.

2. For each repository, it chooses the row with:
	- Largest archive_size_bytes
	- If sizes are equal, newest created_at

3. The outer query then sorts all selected repositories by:
	- Largest archive size = Sort by archive_size_bytes descending (largest first)
	- Newest backup time = If two rows have the same archive_size_bytes, sort by created_at descending (newest first)
*/
