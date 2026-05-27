package service

import (
	"database/sql"
	"fmt"
	"os/exec"
	"time"

	"github.com/MishraShardendu22/github-backup/database"
	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/service/helper"
	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

const (
	pushBatchSize = 10
	repoDelay     = 300 * time.Millisecond
)

func ProcessRepos(repoNames []string, config *model.ConfigModel, db *sql.DB) {
	successCount := 0
	skippedCount := 0
	commitsSincePush := 0
	failedRepos := []string{}

	if err := helper.EnsureReposDirExists(); err != nil {
		util.ErrorHandler(err)
		return
	}

	if err := helper.EnsureBackupRepoInitialized(config); err != nil {
		util.ErrorHandler(err)
		return
	}

	// Handle deleted repos (in DB but no longer on GitHub)
	processDeletedRepos(repoNames, db)
	util.Logger().Info("Starting repository backup")

	for idx, fullName := range repoNames {
		if idx > 0 {
			time.Sleep(repoDelay)
		}

		repoName := helper.ExtractRepoName(fullName)
		url := helper.BuildCloneURL(fullName)
		currentHash := ""

		// Get remote HEAD hash
		hash, err := helper.GetRemoteHeadHash(url)
		if err != nil {
			util.Logger().Warn("Failed to fetch remote hash; will clone anyway",
				zap.String("repository", fullName),
				zap.Error(err),
			)
		} else {
			currentHash = hash

			// Check if repo exists in DB with same hash
			if db != nil {
				dbRepo, found, dbErr := database.GetRepo(db, fullName)
				if dbErr != nil {
					util.Logger().Warn("Failed to read repo from DB; will clone anyway",
						zap.String("repository", fullName),
						zap.Error(dbErr),
					)
				} else if found && dbRepo.LatestCommitHash == currentHash {
					util.Logger().Info("Repository unchanged; skipping",
						zap.String("repository", fullName),
					)
					skippedCount++
					continue
				}
			}
		}

		util.Logger().Info("Processing repository",
			zap.Int("current", idx+1),
			zap.Int("total", len(repoNames)),
			zap.String("repository", fullName),
		)

		// Clean up any existing clone/archive for this repo
		helper.CleanupExistingRepo(repoName)

		// Clone with --bare --depth=1
		if err := helper.CloneRepo(url, repoName); err != nil {
			util.Logger().Error("Failed to clone repository",
				zap.String("repository", fullName),
				zap.Error(err),
			)
			recordFailure(db, fullName, err)
			failedRepos = append(failedRepos, fullName)
			continue
		}

		// Archive: tar.gz the bare clone, then remove the .git dir
		if err := helper.ArchiveRepo(repoName); err != nil {
			util.Logger().Error("Failed to archive repository",
				zap.String("repository", fullName),
				zap.Error(err),
			)
			recordFailure(db, fullName, err)
			failedRepos = append(failedRepos, fullName)
			continue
		}

		// Stage and commit the tarball
		commitMsg := helper.BuildCommitMessage(repoName)
		helper.StageAndCommitRepo(
			fmt.Sprintf("%s.tar.gz", repoName),
			commitMsg,
		)
		commitsSincePush++

		// Batch push: push every pushBatchSize commits
		if commitsSincePush >= pushBatchSize {
			if err := helper.PushBackupRepo("batch"); err != nil {
				util.Logger().Error("Failed to push batch",
					zap.Error(err),
				)
			} else {
				commitsSincePush = 0
			}
		}

		// Update DB with new hash
		if db != nil && currentHash != "" {
			if err := database.UpsertRepo(db, repoName, fullName, url, currentHash); err != nil {
				util.Logger().Warn("Failed to store repository hash",
					zap.String("repository", fullName),
					zap.Error(err),
				)
			}
		}

		successCount++
		util.Logger().Info("Successfully backed up repository",
			zap.String("repository", fullName),
			zap.Int("successful", successCount),
			zap.Int("total", len(repoNames)),
		)
	}

	// Final push for any remaining commits
	if commitsSincePush > 0 {
		if err := helper.PushBackupRepo("final"); err != nil {
			util.Logger().Error("Failed to push final batch",
				zap.Error(err),
			)
		}
	}

	printBackupSummary(repoNames, successCount, skippedCount, failedRepos)
}

func processDeletedRepos(currentRepoNames []string, db *sql.DB) {
	if db == nil {
		return
	}

	dbRepos, err := database.GetAllReposFromDB(db)
	if err != nil {
		util.Logger().Warn("Failed to fetch repos from DB for cleanup", zap.Error(err))
		return
	}

	if len(dbRepos) == 0 {
		return
	}

	// Build set of current repo names for O(1) lookup using map 
	currentSet := make(map[string]bool, len(currentRepoNames))
	for _, name := range currentRepoNames {
		currentSet[name] = true
	}

	deletedCount := 0
	for _, dbRepo := range dbRepos {
		if !currentSet[dbRepo.FullName] {
			util.Logger().Info("Repository no longer on GitHub; removing",
				zap.String("repository", dbRepo.FullName),
			)

			repoName := helper.ExtractRepoName(dbRepo.FullName)
			helper.CleanupExistingRepo(repoName)

			// Stage the removal in the backup repo
			removeCmd := exec.Command("sh", "-c",
				fmt.Sprintf("cd _Repos && git rm -f '%s.tar.gz' 2>/dev/null || true", repoName))
			if out, err := removeCmd.CombinedOutput(); err != nil {
				util.Logger().Warn("Failed to git rm deleted repo archive",
					zap.String("repository", dbRepo.FullName),
					zap.Error(err),
					zap.String("output", string(out)),
				)
			}

			commitMsg := helper.SanitizeCommitMessage(fmt.Sprintf("Removed deleted repo %s on %s",
				repoName, time.Now().Format("2006-01-02 Monday 15:04:05")))
			commitCmd := exec.Command("sh", "-c",
				fmt.Sprintf("cd _Repos && git diff --staged --quiet || git commit -m '%s' -s", commitMsg))
			if _, err := commitCmd.CombinedOutput(); err != nil {
				util.Logger().Warn("Failed to commit deleted repo removal",
					zap.String("repository", dbRepo.FullName),
					zap.Error(err),
				)
			}

			if err := database.DeleteRepo(db, dbRepo.FullName); err != nil {
				util.Logger().Warn("Failed to delete repo from DB",
					zap.String("repository", dbRepo.FullName),
					zap.Error(err),
				)
			}

			deletedCount++
		}
	}

	if deletedCount > 0 {
		util.Logger().Info("Cleaned up deleted repositories",
			zap.Int("count", deletedCount),
		)

		// Push the deletion commits
		if err := helper.PushBackupRepo("deleted-repos-cleanup"); err != nil {
			util.Logger().Warn("Failed to push deleted repo cleanup", zap.Error(err))
		}
	}
}

func recordFailure(db *sql.DB, repo string, failure error) {
	if db == nil || failure == nil {
		return
	}

	if err := database.LogFailure(db, repo, failure); err != nil {
		util.Logger().Warn("Failed to record repository failure",
			zap.String("repository", repo),
			zap.Error(err),
		)
	}
}
