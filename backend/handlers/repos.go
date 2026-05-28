package handlers

import (
	"context"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/gofiber/fiber/v2"
)

func GetRepos(c *fiber.Ctx) error {
	rows, err := db.Pool.Query(context.Background(),
		`SELECT repo_full_name, status, commit_hash, archive_size_bytes, created_at
		 FROM (
		     SELECT DISTINCT ON (repo_full_name)
		         repo_full_name, status, commit_hash, archive_size_bytes, created_at
		     FROM backup_results
		     ORDER BY repo_full_name, archive_size_bytes DESC, created_at DESC
		 ) ranked_repos
		 ORDER BY archive_size_bytes DESC, created_at DESC`)
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
	return c.JSON(repos)
}
