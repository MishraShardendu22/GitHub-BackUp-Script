package handlers

import (
	"context"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/gofiber/fiber/v2"
)

/*
	Backup Handler

	GetBackupRuns()
	- Returns a paginated list of backup runs.

	GetBackupRun()
	- Backup Run + All repository results belonging to that run

	GetLatestBackup
	- Returns only the newest backup run.
*/

func GetBackupRuns(c *fiber.Ctx) error {
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

	ctx := context.Background()
	if _, err := db.FinalizeStaleRunningRuns(ctx, 30*time.Minute); err != nil {
		_ = err
	}

	var totalItems int
	err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM backup_runs").Scan(&totalItems)
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
		`SELECT id, status, started_at, completed_at, total_repos, successful, failed, skipped, duration_ms, error_message
		 FROM backup_runs ORDER BY started_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var runs []models.BackupRun
	for rows.Next() {
		var r models.BackupRun
		if err := rows.Scan(&r.ID, &r.Status, &r.StartedAt, &r.CompletedAt, &r.TotalRepos,
			&r.Successful, &r.Failed, &r.Skipped, &r.DurationMs, &r.ErrorMessage); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		runs = append(runs, r)
	}

	if runs == nil {
		runs = []models.BackupRun{}
	}

	// get all the fixes that were added
	if len(runs) > 0 {
		runIDs := make([]int, len(runs))
		runMap := make(map[int]*models.BackupRun, len(runs))
		for i := range runs {
			runIDs[i] = runs[i].ID
			runMap[runs[i].ID] = &runs[i]
		}

		// fetch the fixes thing from database
		fixesQuery := `
			SELECT f.id, f.title, f.description, f.commit_hash, f.author, f.created_at, f.updated_at, rf.run_id
			FROM backup_fixes f
			JOIN backup_run_fixes rf ON f.id = rf.fix_id
			WHERE rf.run_id = ANY($1)
		`
		fixesRows, err := db.Pool.Query(ctx, fixesQuery, runIDs)
		if err == nil {
			defer fixesRows.Close()
			var fetchedFixes []models.BackupFix
			var runIDsForFixes []int

			for fixesRows.Next() {
				var f models.BackupFix
				var runID int
				if err := fixesRows.Scan(&f.ID, &f.Title, &f.Description, &f.CommitHash, &f.Author, &f.CreatedAt, &f.UpdatedAt, &runID); err == nil {
					fetchedFixes = append(fetchedFixes, f)
					runIDsForFixes = append(runIDsForFixes, runID)
				}
			}

			if len(fetchedFixes) > 0 {
				// Gather all unique fix IDs
				fixIDs := make([]int, 0, len(fetchedFixes))
				seenFixes := make(map[int]bool)
				for _, f := range fetchedFixes {
					if !seenFixes[f.ID] {
						seenFixes[f.ID] = true
						fixIDs = append(fixIDs, f.ID)
					}
				}

				// Fetch all run_ids associated with these fix IDs
				runFixesMap := make(map[int][]int)
				rfRows, err := db.Pool.Query(ctx, "SELECT fix_id, run_id FROM backup_run_fixes WHERE fix_id = ANY($1)", fixIDs)
				if err == nil {
					for rfRows.Next() {
						var fixID, rID int
						if err := rfRows.Scan(&fixID, &rID); err == nil {
							runFixesMap[fixID] = append(runFixesMap[fixID], rID)
						}
					}
					rfRows.Close()
				}

				// Populate AffectedRuns and append to runs
				for idx, f := range fetchedFixes {
					f.AffectedRuns = runFixesMap[f.ID]
					if f.AffectedRuns == nil {
						f.AffectedRuns = []int{}
					}
					runID := runIDsForFixes[idx]
					if runPtr, exists := runMap[runID]; exists {
						runPtr.Fixes = append(runPtr.Fixes, f)
					}
				}
			}
		}
	}

	return c.JSON(models.PaginatedResponse{
		Data: runs,
		Pagination: models.PaginationMeta{
			Page:       page,
			Limit:      limit,
			TotalItems: totalItems,
			TotalPages: totalPages,
		},
	})
}

func GetBackupRun(c *fiber.Ctx) error {
	id := c.Params("id")

	var r models.BackupRun
	err := db.Pool.QueryRow(context.Background(),
		`SELECT id, status, started_at, completed_at, total_repos, successful, failed, skipped, duration_ms, error_message
		 FROM backup_runs WHERE id = $1`, id).Scan(
		&r.ID, &r.Status, &r.StartedAt, &r.CompletedAt, &r.TotalRepos,
		&r.Successful, &r.Failed, &r.Skipped, &r.DurationMs, &r.ErrorMessage)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "run not found"})
	}

	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, run_id, repo_full_name, status, commit_hash, archive_size_bytes, duration_ms, error_message, created_at
		 FROM backup_results WHERE run_id = $1 ORDER BY created_at`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var results []models.BackupResult
	for rows.Next() {
		var br models.BackupResult
		if err := rows.Scan(&br.ID, &br.RunID, &br.RepoFullName, &br.Status, &br.CommitHash,
			&br.ArchiveSizeBytes, &br.DurationMs, &br.ErrorMessage, &br.CreatedAt); err != nil {
			continue
		}
		results = append(results, br)
	}

	if results == nil {
		results = []models.BackupResult{}
	}

	// Fetch associated fixes
	fixesRows, err := db.Pool.Query(context.Background(),
		`SELECT f.id, f.title, f.description, f.commit_hash, f.author, f.created_at, f.updated_at
		 FROM backup_fixes f
		 JOIN backup_run_fixes rf ON f.id = rf.fix_id
		 WHERE rf.run_id = $1`, r.ID)
	if err == nil {
		defer fixesRows.Close()
		var fixes []models.BackupFix
		var fixIDs []int
		for fixesRows.Next() {
			var f models.BackupFix
			if err := fixesRows.Scan(&f.ID, &f.Title, &f.Description, &f.CommitHash, &f.Author, &f.CreatedAt, &f.UpdatedAt); err == nil {
				fixes = append(fixes, f)
				fixIDs = append(fixIDs, f.ID)
			}
		}

		if len(fixIDs) > 0 {
			affectedRunsMap := make(map[int][]int)
			rfRows, err := db.Pool.Query(context.Background(), "SELECT fix_id, run_id FROM backup_run_fixes WHERE fix_id = ANY($1)", fixIDs)
			if err == nil {
				for rfRows.Next() {
					var fixID, runID int
					if err := rfRows.Scan(&fixID, &runID); err == nil {
						affectedRunsMap[fixID] = append(affectedRunsMap[fixID], runID)
					}
				}
				rfRows.Close()
			}

			for i := range fixes {
				if runs, ok := affectedRunsMap[fixes[i].ID]; ok {
					fixes[i].AffectedRuns = runs
				}
			}
		}
		r.Fixes = fixes
	}

	return c.JSON(fiber.Map{"run": r, "results": results})
}

func GetLatestBackup(c *fiber.Ctx) error {
	ctx := context.Background()
	if _, err := db.FinalizeStaleRunningRuns(ctx, 30*time.Minute); err != nil {
		_ = err
	}

	var r models.BackupRun
	err := db.Pool.QueryRow(ctx,
		`SELECT id, status, started_at, completed_at, total_repos, successful, failed, skipped, duration_ms, error_message
		 FROM backup_runs ORDER BY started_at DESC LIMIT 1`).Scan(
		&r.ID, &r.Status, &r.StartedAt, &r.CompletedAt, &r.TotalRepos,
		&r.Successful, &r.Failed, &r.Skipped, &r.DurationMs, &r.ErrorMessage)
	if err != nil {
		return c.JSON(fiber.Map{"run": nil})
	}
	// Fetch associated fixes
	fixesRows, err := db.Pool.Query(ctx,
		`SELECT f.id, f.title, f.description, f.commit_hash, f.author, f.created_at, f.updated_at
		 FROM backup_fixes f
		 JOIN backup_run_fixes rf ON f.id = rf.fix_id
		 WHERE rf.run_id = $1`, r.ID)
	if err == nil {
		defer fixesRows.Close()
		for fixesRows.Next() {
			var f models.BackupFix
			if err := fixesRows.Scan(&f.ID, &f.Title, &f.Description, &f.CommitHash, &f.Author, &f.CreatedAt, &f.UpdatedAt); err == nil {
				// Fetch affected runs for this fix
				var affectedRuns []int
				rfRows, err := db.Pool.Query(ctx, "SELECT run_id FROM backup_run_fixes WHERE fix_id = $1", f.ID)
				if err == nil {
					for rfRows.Next() {
						var runID int
						if err := rfRows.Scan(&runID); err == nil {
							affectedRuns = append(affectedRuns, runID)
						}
					}
					rfRows.Close()
				}
				f.AffectedRuns = affectedRuns
				r.Fixes = append(r.Fixes, f)
			}
		}
	}

	return c.JSON(fiber.Map{"run": r})
}

/*

Query vs QueryRow

Query
	rows, err := db.Pool.Query(...)
	Use when expecting 0..N rows

	Examples:

	all users
	all backup runs
	all logs

QueryRow
	row := db.Pool.QueryRow(...)
	Use when expecting exactly one row

	Examples:

	user by id
	backup by id
	latest backup
*/
