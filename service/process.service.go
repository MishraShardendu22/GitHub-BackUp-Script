package service

import (
	"database/sql"
	"fmt"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"

	"github.com/MishraShardendu22/github-backup/database"
	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/service/helper"
	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

const (
	pushBatchSize   = 10
	cloneWorkers    = 5
	hashCheckWorkers = 10
)

type repoResult struct {
	FullName    string
	RepoName    string
	URL         string
	CurrentHash string
	Err         error
}

type repoHashResult struct {
	FullName    string
	RepoName    string
	URL         string
	CurrentHash string
	HashErr     error
	Skipped     bool
}

func ProcessRepos(repoNames []string, config *model.ConfigModel, db *sql.DB) {
	if err := helper.EnsureReposDirExists(); err != nil {
		util.ErrorHandler(err)
		return
	}

	if err := helper.EnsureBackupRepoInitialized(config); err != nil {
		util.ErrorHandler(err)
		return
	}

	// Phase 0: Handle deleted repos in parallel
	processDeletedRepos(repoNames, db)

	util.Logger().Info("Starting repository backup")

	// Phase 1: Parallel hash checks to determine which repos need cloning
	util.Logger().Info("Phase 1: Checking repository hashes",
		zap.Int("total", len(repoNames)),
		zap.Int("workers", hashCheckWorkers),
	)
	hashResults := parallelHashCheck(repoNames, db)

	// Separate into repos that need cloning vs skipped
	var toClone []repoHashResult
	skippedCount := 0
	for _, hr := range hashResults {
		if hr.Skipped {
			skippedCount++
			continue
		}
		toClone = append(toClone, hr)
	}

	util.Logger().Info("Hash check complete",
		zap.Int("to_clone", len(toClone)),
		zap.Int("skipped_unchanged", skippedCount),
	)

	if len(toClone) == 0 {
		printBackupSummary(repoNames, 0, skippedCount, nil)
		return
	}

	// Phase 2: Parallel clone + archive (5 workers)
	util.Logger().Info("Phase 2: Cloning and archiving repositories",
		zap.Int("count", len(toClone)),
		zap.Int("workers", cloneWorkers),
	)
	cloneResults := parallelCloneAndArchive(toClone)

	// Phase 3: Serial commit + batch push (git operations on working tree must be serial)
	util.Logger().Info("Phase 3: Committing and pushing backups")
	successCount, failedRepos := serialCommitAndPush(cloneResults, db)

	printBackupSummary(repoNames, successCount, skippedCount, failedRepos)
}

// parallelHashCheck runs git ls-remote + DB hash comparison concurrently
func parallelHashCheck(repoNames []string, db *sql.DB) []repoHashResult {
	results := make([]repoHashResult, len(repoNames))
	var wg sync.WaitGroup
	sem := make(chan struct{}, hashCheckWorkers)

	for i, fullName := range repoNames {
		wg.Add(1)
		go func(idx int, fullName string) {
			defer wg.Done()
			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release

			repoName := helper.ExtractRepoName(fullName)
			url := helper.BuildCloneURL(fullName)

			hr := repoHashResult{
				FullName: fullName,
				RepoName: repoName,
				URL:      url,
			}

			hash, err := helper.GetRemoteHeadHash(url)
			if err != nil {
				util.Logger().Warn("Failed to fetch remote hash; will clone anyway",
					zap.String("repository", fullName),
					zap.Error(err),
				)
				hr.HashErr = err
				results[idx] = hr
				return
			}

			hr.CurrentHash = hash

			if db != nil {
				dbRepo, found, dbErr := database.GetRepo(db, fullName)
				if dbErr != nil {
					util.Logger().Warn("Failed to read repo from DB; will clone anyway",
						zap.String("repository", fullName),
						zap.Error(dbErr),
					)
				} else if found && dbRepo.LatestCommitHash == hash {
					util.Logger().Info("Repository unchanged; skipping",
						zap.String("repository", fullName),
					)
					hr.Skipped = true
					results[idx] = hr
					return
				}
			}

			results[idx] = hr
		}(i, fullName)
	}

	wg.Wait()
	return results
}

// parallelCloneAndArchive runs clone + archive with a worker pool
func parallelCloneAndArchive(repos []repoHashResult) []repoResult {
	results := make([]repoResult, len(repos))
	var wg sync.WaitGroup
	sem := make(chan struct{}, cloneWorkers)
	var processed int64

	total := len(repos)

	for i, hr := range repos {
		wg.Add(1)
		go func(idx int, hr repoHashResult) {
			defer wg.Done()
			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release

			current := atomic.AddInt64(&processed, 1)
			util.Logger().Info("Cloning repository",
				zap.Int64("current", current),
				zap.Int("total", total),
				zap.String("repository", hr.FullName),
			)

			res := repoResult{
				FullName:    hr.FullName,
				RepoName:    hr.RepoName,
				URL:         hr.URL,
				CurrentHash: hr.CurrentHash,
			}

			// Clean up any existing clone/archive
			helper.CleanupExistingRepo(hr.RepoName)

			// Clone with --bare --depth=1
			if err := helper.CloneRepo(hr.URL, hr.RepoName); err != nil {
				util.Logger().Error("Failed to clone repository",
					zap.String("repository", hr.FullName),
					zap.Error(err),
				)
				res.Err = err
				results[idx] = res
				return
			}

			// Archive: tar.gz the bare clone, then remove the .git dir
			if err := helper.ArchiveRepo(hr.RepoName); err != nil {
				util.Logger().Error("Failed to archive repository",
					zap.String("repository", hr.FullName),
					zap.Error(err),
				)
				res.Err = err
				results[idx] = res
				return
			}

			util.Logger().Info("Clone + archive complete",
				zap.String("repository", hr.FullName),
			)

			results[idx] = res
		}(i, hr)
	}

	wg.Wait()
	return results
}

// serialCommitAndPush handles git add/commit/push sequentially (git working tree is not concurrent-safe)
func serialCommitAndPush(results []repoResult, db *sql.DB) (int, []string) {
	successCount := 0
	commitsSincePush := 0
	var failedRepos []string

	for _, res := range results {
		if res.Err != nil {
			recordFailure(db, res.FullName, res.Err)
			failedRepos = append(failedRepos, res.FullName)
			continue
		}

		// Stage and commit the tarball
		commitMsg := helper.BuildCommitMessage(res.RepoName)
		helper.StageAndCommitRepo(
			fmt.Sprintf("%s.tar.gz", res.RepoName),
			commitMsg,
		)
		commitsSincePush++

		// Batch push
		if commitsSincePush >= pushBatchSize {
			if err := helper.PushBackupRepo("batch"); err != nil {
				util.Logger().Error("Failed to push batch", zap.Error(err))
			} else {
				commitsSincePush = 0
			}
		}

		// Update DB with new hash
		if db != nil && res.CurrentHash != "" {
			if err := database.UpsertRepo(db, res.RepoName, res.FullName, res.URL, res.CurrentHash); err != nil {
				util.Logger().Warn("Failed to store repository hash",
					zap.String("repository", res.FullName),
					zap.Error(err),
				)
			}
		}

		successCount++
		util.Logger().Info("Successfully backed up repository",
			zap.String("repository", res.FullName),
		)
	}

	// Final push for remaining commits
	if commitsSincePush > 0 {
		if err := helper.PushBackupRepo("final"); err != nil {
			util.Logger().Error("Failed to push final batch", zap.Error(err))
		}
	}

	return successCount, failedRepos
}

// processDeletedRepos cleans up repos that exist in DB but are no longer on GitHub — fully parallel
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

	// Build set of current repo names for O(1) lookup
	currentSet := make(map[string]bool, len(currentRepoNames))
	for _, name := range currentRepoNames {
		currentSet[name] = true
	}

	// Find repos to delete
	var toDelete []model.RepoRecord
	for _, dbRepo := range dbRepos {
		if !currentSet[dbRepo.FullName] {
			toDelete = append(toDelete, dbRepo)
		}
	}

	if len(toDelete) == 0 {
		return
	}

	util.Logger().Info("Cleaning up deleted repositories",
		zap.Int("count", len(toDelete)),
	)

	// Parallel: file cleanup + DB deletion
	var wg sync.WaitGroup
	var deletedCount int64

	for _, dbRepo := range toDelete {
		wg.Add(1)
		go func(repo model.RepoRecord) {
			defer wg.Done()

			util.Logger().Info("Repository no longer on GitHub; removing",
				zap.String("repository", repo.FullName),
			)

			repoName := helper.ExtractRepoName(repo.FullName)
			helper.CleanupExistingRepo(repoName)

			if err := database.DeleteRepo(db, repo.FullName); err != nil {
				util.Logger().Warn("Failed to delete repo from DB",
					zap.String("repository", repo.FullName),
					zap.Error(err),
				)
				return
			}

			atomic.AddInt64(&deletedCount, 1)
		}(dbRepo)
	}

	wg.Wait()

	// Serial: git rm + commit for all deleted repos (git operations must be serial)
	for _, dbRepo := range toDelete {
		repoName := helper.ExtractRepoName(dbRepo.FullName)
		removeCmd := exec.Command("sh", "-c",
			fmt.Sprintf("cd _Repos && git rm -f '%s.tar.gz' 2>/dev/null || true", repoName))
		if out, err := removeCmd.CombinedOutput(); err != nil {
			util.Logger().Warn("Failed to git rm deleted repo archive",
				zap.String("repository", dbRepo.FullName),
				zap.Error(err),
				zap.String("output", string(out)),
			)
		}
	}

	// Single commit for all deletions
	commitMsg := helper.SanitizeCommitMessage(fmt.Sprintf("Removed %d deleted repo(s) on %s",
		deletedCount, time.Now().Format("2006-01-02 Monday 15:04:05")))
	commitCmd := exec.Command("sh", "-c",
		fmt.Sprintf("cd _Repos && git diff --staged --quiet || git commit -m '%s' -s", commitMsg))
	if _, err := commitCmd.CombinedOutput(); err != nil {
		util.Logger().Warn("Failed to commit deleted repo removals", zap.Error(err))
	}

	if deletedCount > 0 {
		util.Logger().Info("Cleaned up deleted repositories",
			zap.Int64("count", deletedCount),
		)

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
