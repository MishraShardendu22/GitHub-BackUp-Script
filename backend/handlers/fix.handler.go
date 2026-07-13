package handlers

import (
	"context"
	"strconv"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/gofiber/fiber/v2"
)

/*
This handler is basically to get the fix details, indivisually and per run.
there details and other related data.

No route to add or edit in backend cause only verified user should add,
added them in python backend
*/

// GetBackupFixes returns all fixes ordered by created_at DESC.
func GetBackupFixes(c *fiber.Ctx) error {
	ctx := context.Background()
	rows, err := db.Pool.Query(ctx,
		`SELECT id, title, description, commit_hash, author, created_at, updated_at 
		 FROM backup_fixes ORDER BY created_at DESC`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var fixes []models.BackupFix
	for rows.Next() {
		var f models.BackupFix
		if err := rows.Scan(&f.ID, &f.Title, &f.Description, &f.CommitHash, &f.Author, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		fixes = append(fixes, f)
	}

	if fixes == nil {
		fixes = []models.BackupFix{}
	}

	// Fetch run mappings for each fix
	for i := range fixes {
		runRows, err := db.Pool.Query(ctx, "SELECT run_id FROM backup_run_fixes WHERE fix_id = $1", fixes[i].ID)
		if err == nil {
			var runs []int
			for runRows.Next() {
				var runID int
				if err := runRows.Scan(&runID); err == nil {
					runs = append(runs, runID)
				}
			}
			runRows.Close()
			fixes[i].AffectedRuns = runs
		}
	}

	return c.JSON(fixes)
}

// GetBackupFix returns details of a single fix.
func GetBackupFix(c *fiber.Ctx) error {
	id := c.Params("id")
	ctx := context.Background()

	var f models.BackupFix
	err := db.Pool.QueryRow(ctx,
		`SELECT id, title, description, commit_hash, author, created_at, updated_at 
		 FROM backup_fixes WHERE id = $1`, id).Scan(
		&f.ID, &f.Title, &f.Description, &f.CommitHash, &f.Author, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "fix not found"})
	}

	// Fetch affected runs
	runRows, err := db.Pool.Query(ctx, "SELECT run_id FROM backup_run_fixes WHERE fix_id = $1", f.ID)
	if err == nil {
		defer runRows.Close()
		var runs []int
		for runRows.Next() {
			var runID int
			if err := runRows.Scan(&runID); err == nil {
				runs = append(runs, runID)
			}
		}
		f.AffectedRuns = runs
	}

	return c.JSON(f)
}

// GetBackupRunFixes returns fixes associated with a specific run.
func GetBackupRunFixes(c *fiber.Ctx) error {
	runIDStr := c.Params("id")
	runID, err := strconv.Atoi(runIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid run ID"})
	}

	ctx := context.Background()
	rows, err := db.Pool.Query(ctx,
		`SELECT f.id, f.title, f.description, f.commit_hash, f.author, f.created_at, f.updated_at 
		 FROM backup_fixes f
		 JOIN backup_run_fixes rf ON f.id = rf.fix_id
		 WHERE rf.run_id = $1
		 ORDER BY f.created_at DESC`, runID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var fixes []models.BackupFix
	for rows.Next() {
		var f models.BackupFix
		if err := rows.Scan(&f.ID, &f.Title, &f.Description, &f.CommitHash, &f.Author, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		fixes = append(fixes, f)
	}

	if fixes == nil {
		fixes = []models.BackupFix{}
	}

	// Fetch run mappings for each fix
	for i := range fixes {
		runRows, err := db.Pool.Query(ctx, "SELECT run_id FROM backup_run_fixes WHERE fix_id = $1", fixes[i].ID)
		if err == nil {
			var runs []int
			for runRows.Next() {
				var runID int
				if err := runRows.Scan(&runID); err == nil {
					runs = append(runs, runID)
				}
			}
			runRows.Close()
			fixes[i].AffectedRuns = runs
		}
	}

	return c.JSON(fixes)
}
