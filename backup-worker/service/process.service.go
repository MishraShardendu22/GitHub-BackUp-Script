package service

import (
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"

	"github.com/MishraShardendu22/github-backup/backup-worker/database"
	"github.com/MishraShardendu22/github-backup/backup-worker/model"
	"github.com/MishraShardendu22/github-backup/backup-worker/service/helper"
	"github.com/MishraShardendu22/github-backup/backup-worker/service/monitor"
	"github.com/MishraShardendu22/github-backup/backup-worker/util"
	"go.uber.org/zap"
)

// check the flow in the end
const (
	cloneWorkers      = 5
	hashCheckWorkers  = 10
	maxGitHubBlobSize = 95 * 1024 * 1024
)

func ProcessRepos(repoNames []string, config *model.ConfigModel, db *sql.DB) {
	// storing the duration of each repo backup in ms
	// if start is zero it means backup did not start so return 0 otherwise return the duration in ms
	repoDurationMs := func(start time.Time) int64 {
		if start.IsZero() {
			return 0
		}
		return time.Since(start).Milliseconds()
	}

	// 1.
	if err := helper.EnsureReposDirExists(); err != nil {
		util.ErrorHandler(err)
		return
	}

	// 2.
	if err := helper.EnsureBackupRepoInitialized(config); err != nil {
		util.ErrorHandler(err)
		return
	}

	// 3.
	processDeletedRepos(repoNames, db)

	util.Logger().Info("Starting repository backup")

	// start saving data in cloud postgres
	mon := monitor.Get()
	start := time.Now()
	if mon != nil {
		mon.StartRun(len(repoNames))
		mon.Log("info", fmt.Sprintf("Starting backup of %d repositories", len(repoNames)), "")
	}

	util.Logger().Info("Phase 1: Checking repository hashes",
		zap.Int("total", len(repoNames)),
		zap.Int("workers", hashCheckWorkers),
	)

	// 4.
	hashResults := parallelHashCheck(repoNames, db)

	var toClone []model.RepoHashResult
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
		if mon != nil {
			durationMs := time.Since(start).Milliseconds()
			mon.CompleteRun(0, 0, skippedCount, durationMs, "")
			mon.Log("info", fmt.Sprintf("All %d repos up to date, nothing to clone", skippedCount), "")
		}
		printBackupSummaryFillAnalytics(repoNames, 0, skippedCount, nil, mon)
		return
	}

	// Phase 2+3: Process in batches of 5 — clone+archive in parallel, then commit+push each one
	util.Logger().Info("Phase 2+3: Clone, archive, commit, push in batches",
		zap.Int("total", len(toClone)),
		zap.Int("batch_size", cloneWorkers),
	)

	successCount := 0
	var failedRepos []string

	for batchStart := 0; batchStart < len(toClone); batchStart += cloneWorkers {
		batchEnd := batchStart + cloneWorkers
		if batchEnd > len(toClone) {
			batchEnd = len(toClone)
		}
		batch := toClone[batchStart:batchEnd]

		util.Logger().Info("Processing batch",
			zap.Int("batch_start", batchStart+1),
			zap.Int("batch_end", batchEnd),
			zap.Int("total", len(toClone)),
		)

		// 5. Clone + archive in parallel (5 at a time, 10 fail kar raha tha)
		cloneResults := parallelCloneAndArchive(batch)

		// 6. Commit + push EACH repo individually (serial, one by one)
		for _, res := range cloneResults {
			if res.Err != nil {
				recordFailure(db, res.FullName, res.Err)
				failedRepos = append(failedRepos, res.FullName)
				if mon != nil {
					mon.LogRepoResult(res.FullName, "failed", res.CurrentHash, 0, repoDurationMs(res.StartedAt), res.Err.Error())
					mon.Log("error", "Backup failed: "+res.Err.Error(), res.FullName)
					mon.UpdateProgress(successCount, len(failedRepos), skippedCount)
				}
				continue
			}

			// 7. Stage the tarball
			tarball := fmt.Sprintf("%s.tar.gz", res.RepoName)
			archivePath := fmt.Sprintf("_Repos/%s", tarball)
			info, err := os.Stat(archivePath)
			if err != nil {
				util.Logger().Warn("Failed to inspect archive size; skipping repository",
					zap.String("repository", res.FullName),
					zap.Error(err),
				)
				failedRepos = append(failedRepos, res.FullName)
				if mon != nil {
					mon.LogRepoResult(res.FullName, "failed", res.CurrentHash, 0, repoDurationMs(res.StartedAt), err.Error())
					mon.Log("error", "Archive inspection failed: "+err.Error(), res.FullName)
					mon.UpdateProgress(successCount, len(failedRepos), skippedCount)
				}
				continue
			}
			res.ArchiveSize = info.Size()

			if info.Size() > maxGitHubBlobSize {
				util.Logger().Warn(
					fmt.Sprintf("Skipping repo %s: archive exceeds GitHub blob limit (%d MB)",
						res.FullName,
						info.Size()/(1024*1024),
					),
				)
				skippedCount++
				if mon != nil {
					mon.Log("warn", fmt.Sprintf("Skipping oversized archive for %s", res.FullName), res.FullName)
					mon.UpdateProgress(successCount, len(failedRepos), skippedCount)
				}
				continue
			}

			commitMsg := helper.BuildCommitMessage(res.RepoName)
			if err := helper.StageAndCommitRepo(tarball, commitMsg); err != nil {
				util.Logger().Error("Failed to commit repo",
					zap.String("repository", res.FullName),
					zap.Error(err),
				)
				failedRepos = append(failedRepos, res.FullName)
				if mon != nil {
					mon.LogRepoResult(res.FullName, "failed", res.CurrentHash, res.ArchiveSize, repoDurationMs(res.StartedAt), "commit failed: "+err.Error())
					mon.Log("error", "Commit failed: "+err.Error(), res.FullName)
					mon.UpdateProgress(successCount, len(failedRepos), skippedCount)
				}
				continue
			}

			// 8. Push THIS repo immediately
			if err := helper.PushBackupRepo(res.RepoName); err != nil {
				util.Logger().Error("Failed to push repo",
					zap.String("repository", res.FullName),
					zap.Error(err),
				)
				failedRepos = append(failedRepos, res.FullName)
				if mon != nil {
					mon.LogRepoResult(res.FullName, "failed", res.CurrentHash, res.ArchiveSize, repoDurationMs(res.StartedAt), "push failed: "+err.Error())
					mon.Log("error", "Push failed: "+err.Error(), res.FullName)
					mon.UpdateProgress(successCount, len(failedRepos), skippedCount)
				}
				continue
			}

			// 9. Update DB with new hash
			if db != nil && res.CurrentHash != "" {
				if err := database.UpsertRepo(db, res.RepoName, res.FullName, res.URL, res.CurrentHash); err != nil {
					util.Logger().Warn("Failed to store repository hash",
						zap.String("repository", res.FullName),
						zap.Error(err),
					)
				}
			}

			successCount++
			util.Logger().Info("Backed up and pushed",
				zap.String("repository", res.FullName),
			)
			if mon != nil {
				mon.LogRepoResult(res.FullName, "completed", res.CurrentHash, res.ArchiveSize, repoDurationMs(res.StartedAt), "")
				mon.Log("info", "Backup completed and pushed", res.FullName)
				mon.UpdateProgress(successCount, len(failedRepos), skippedCount)
			}
		}
	}

	if mon != nil {
		durationMs := time.Since(start).Milliseconds()
		errMsg := ""
		if len(failedRepos) > 0 {
			errMsg = fmt.Sprintf("%d repos failed", len(failedRepos))
		}
		mon.CompleteRun(successCount, len(failedRepos), skippedCount, durationMs, errMsg)
		mon.Log("info", fmt.Sprintf("Backup complete: %d success, %d failed, %d skipped in %dms",
			successCount, len(failedRepos), skippedCount, durationMs), "")
	}

	printBackupSummaryFillAnalytics(repoNames, successCount, skippedCount, failedRepos, mon)
}

// parallely check the hashes of the repos
func parallelHashCheck(repoNames []string, db *sql.DB) []model.RepoHashResult {
	results := make([]model.RepoHashResult, len(repoNames))
	var wg sync.WaitGroup

	// It is being used as a counting semaphore.
	// a synchronization primitive used to control access to shared resources in concurrent systems
	// basically it is a mechanism to control to make sure 2 thread (here go routines) dont interfere with each others work
	sem := make(chan struct{}, hashCheckWorkers)

	for i, fullName := range repoNames {
		wg.Add(1)
		go func(idx int, fullName string) {
			defer wg.Done()
			sem <- struct{}{}        // acquire (a place is taken in the channel)
			defer func() { <-sem }() // release (at the end of execution space is freed)

			repoName := helper.ExtractRepoName(fullName)
			url := helper.BuildCloneURL(fullName)

			hr := model.RepoHashResult{
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
func parallelCloneAndArchive(repos []model.RepoHashResult) []model.RepoResult {
	results := make([]model.RepoResult, len(repos))
	var wg sync.WaitGroup
	sem := make(chan struct{}, cloneWorkers)
	var processed atomic.Int64

	total := len(repos)

	for i, hr := range repos {
		wg.Add(1)
		go func(idx int, hr model.RepoHashResult) {
			// same concept of cahnnels as hash
			defer wg.Done()
			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release

			current := processed.Add(1)
			util.Logger().Info("Cloning repository",
				zap.Int64("current", current),
				zap.Int("total", total),
				zap.String("repository", hr.FullName),
			)

			res := model.RepoResult{
				FullName:    hr.FullName,
				RepoName:    hr.RepoName,
				URL:         hr.URL,
				CurrentHash: hr.CurrentHash,
				StartedAt:   time.Now(),
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

/* save failures in db */
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

/*
1. Check if backup dir exist locally
    ↓
2. Check if backup repo is initialised
    ↓
3. processDeletedRepos
    ↓
4. Hash Check
    ↓
5. Clone
    ↓
6. Remove .git
    ↓
7. Archive (.tar.gz)
        ↓
8-a. git add
		↓
8-b. git commit
		↓
8-c. git push
        ↓
9. Store latest hash in DB
*/
