package handlers

import (
	"context"
	"strconv"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/gofiber/fiber/v2"
)

// GetBackupFixes returns all fixes ordered by created_at DESC.
func GetBackupFixes(c *fiber.Ctx) error {
	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(reqCtx, 15*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, title, description, commit_hash, author, created_at, updated_at 
		 FROM backup_fixes ORDER BY created_at DESC`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var fixes []models.BackupFix
	var fixIDs []int
	for rows.Next() {
		var f models.BackupFix
		if err := rows.Scan(&f.ID, &f.Title, &f.Description, &f.CommitHash, &f.Author, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		f.AffectedRuns = []int{}
		fixes = append(fixes, f)
		fixIDs = append(fixIDs, f.ID)
	}

	if fixes == nil {
		fixes = []models.BackupFix{}
	}

	// Batch fetch run mappings for all fixes
	if len(fixIDs) > 0 {
		runRows, err := db.Pool.Query(ctx, "SELECT fix_id, run_id FROM backup_run_fixes WHERE fix_id = ANY($1)", fixIDs)
		if err == nil {
			defer runRows.Close()
			runMap := make(map[int][]int)
			for runRows.Next() {
				var fixID, runID int
				if err := runRows.Scan(&fixID, &runID); err == nil {
					runMap[fixID] = append(runMap[fixID], runID)
				}
			}
			for i := range fixes {
				if runs, ok := runMap[fixes[i].ID]; ok {
					fixes[i].AffectedRuns = runs
				}
			}
		}
	}

	return c.JSON(fixes)
}

// GetBackupFix returns details of a single fix.
func GetBackupFix(c *fiber.Ctx) error {
	id := c.Params("id")
	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(reqCtx, 10*time.Second)
	defer cancel()

	var f models.BackupFix
	err := db.Pool.QueryRow(ctx,
		`SELECT id, title, description, commit_hash, author, created_at, updated_at 
		 FROM backup_fixes WHERE id = $1`, id).Scan(
		&f.ID, &f.Title, &f.Description, &f.CommitHash, &f.Author, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "fix not found"})
	}

	f.AffectedRuns = []int{}

	// Fetch affected runs
	runRows, err := db.Pool.Query(ctx, "SELECT run_id FROM backup_run_fixes WHERE fix_id = $1", f.ID)
	if err == nil {
		defer runRows.Close()
		for runRows.Next() {
			var runID int
			if err := runRows.Scan(&runID); err == nil {
				f.AffectedRuns = append(f.AffectedRuns, runID)
			}
		}
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

	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(reqCtx, 15*time.Second)
	defer cancel()

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
	var fixIDs []int
	for rows.Next() {
		var f models.BackupFix
		if err := rows.Scan(&f.ID, &f.Title, &f.Description, &f.CommitHash, &f.Author, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		f.AffectedRuns = []int{}
		fixes = append(fixes, f)
		fixIDs = append(fixIDs, f.ID)
	}

	if fixes == nil {
		fixes = []models.BackupFix{}
	}

	// Batch fetch all run mappings for the returned fixes
	if len(fixIDs) > 0 {
		runRows, err := db.Pool.Query(ctx, "SELECT fix_id, run_id FROM backup_run_fixes WHERE fix_id = ANY($1)", fixIDs)
		if err == nil {
			defer runRows.Close()
			runMap := make(map[int][]int)
			for runRows.Next() {
				var fixID, rID int
				if err := runRows.Scan(&fixID, &rID); err == nil {
					runMap[fixID] = append(runMap[fixID], rID)
				}
			}
			for i := range fixes {
				if runs, ok := runMap[fixes[i].ID]; ok {
					fixes[i].AffectedRuns = runs
				}
			}
		}
	}

	return c.JSON(fixes)
}
