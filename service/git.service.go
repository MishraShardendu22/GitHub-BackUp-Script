package service

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/database"
	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

const (
	maxRetries    = 3
	pushBatchSize = 10
	pushTimeout   = 5 * time.Minute
	baseDelay     = 2 * time.Second
	cloneTimeout  = 10 * time.Minute
	repoDelay     = 300 * time.Millisecond
)

func sanitizeCommitMessage(msg string) string {
	msg = strings.ReplaceAll(msg, "'", "'\\''")
	msg = strings.ReplaceAll(msg, "\"", "\\\"")
	msg = strings.ReplaceAll(msg, "`", "\\`")
	msg = strings.ReplaceAll(msg, "$", "\\$")
	return msg
}

func retryCommand(cmdFunc func() *exec.Cmd, operation string, timeout time.Duration) error {
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		cmd := cmdFunc()
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		err := cmd.Start()
		if err != nil {
			cancel()
			return fmt.Errorf("%s: failed to start command: %v", operation, err)
		}

		done := make(chan error, 1)
		go func() {
			done <- cmd.Wait()
		}()

		select {
		case <-ctx.Done():
			cmd.Process.Kill()
			cancel()
			lastErr = fmt.Errorf("%s: timeout after %v", operation, timeout)

			if attempt < maxRetries {
				delay := baseDelay * time.Duration(1<<uint(attempt-1))
				util.Logger().Warn("Command timed out; retrying",
					zap.Int("attempt", attempt),
					zap.Int("max_retries", maxRetries),
					zap.String("operation", operation),
					zap.Duration("retry_in", delay),
				)
				time.Sleep(delay)
				continue
			}
		case err := <-done:
			cancel()
			if err == nil {
				return nil
			}
			lastErr = fmt.Errorf("%s: %v", operation, err)

			errorStr := err.Error()
			isTransient := strings.Contains(errorStr, "Could not resolve hostname") ||
				strings.Contains(errorStr, "Connection reset") ||
				strings.Contains(errorStr, "Connection timed out") ||
				strings.Contains(errorStr, "temporary failure") ||
				strings.Contains(errorStr, "early EOF")

			if !isTransient {
				return lastErr
			}

			if attempt < maxRetries {
				delay := baseDelay * time.Duration(1<<uint(attempt-1))
				util.Logger().Warn("Command failed with transient error; retrying",
					zap.Int("attempt", attempt),
					zap.Int("max_retries", maxRetries),
					zap.String("operation", operation),
					zap.Duration("retry_in", delay),
					zap.Error(err),
				)
				time.Sleep(delay)
			}
		}
	}

	return fmt.Errorf("%s failed after %d attempts: %v", operation, maxRetries, lastErr)
}

func ProcessRepos(repoNames []string, config *model.ConfigModel, db *sql.DB) {
	successCount := 0
	skippedCount := 0
	commitsSincePush := 0
	failedRepos := []string{}

	if err := ensureReposDirExists(); err != nil {
		util.ErrorHandler(err)
		return
	}

	if err := ensureBackupRepoInitialized(config); err != nil {
		util.ErrorHandler(err)
		return
	}

	// Handle deleted repos (in DB but no longer on GitHub)
	processDeletedRepos(repoNames, config, db)

	util.Logger().Info("Starting repository backup")

	for idx, fullName := range repoNames {
		if idx > 0 {
			time.Sleep(repoDelay)
		}

		repoName := extractRepoName(fullName)
		url := buildCloneURL(fullName)
		currentHash := ""

		// Get remote HEAD hash
		hash, err := getRemoteHeadHash(url)
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
		cleanupExistingRepo(repoName)

		// Clone with --bare --depth=1
		if err := cloneRepo(url, repoName); err != nil {
			util.Logger().Error("Failed to clone repository",
				zap.String("repository", fullName),
				zap.Error(err),
			)
			recordFailure(db, fullName, err)
			failedRepos = append(failedRepos, fullName)
			continue
		}

		// Archive: tar.gz the bare clone, then remove the .git dir
		if err := archiveRepo(repoName); err != nil {
			util.Logger().Error("Failed to archive repository",
				zap.String("repository", fullName),
				zap.Error(err),
			)
			recordFailure(db, fullName, err)
			failedRepos = append(failedRepos, fullName)
			continue
		}

		// Stage and commit the tarball
		commitMsg := buildCommitMessage(repoName)
		stageAndCommitRepo(
			fmt.Sprintf("%s.tar.gz", repoName),
			commitMsg,
		)
		commitsSincePush++

		// Batch push: push every pushBatchSize commits
		if commitsSincePush >= pushBatchSize {
			if err := pushBackupRepo("batch"); err != nil {
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
		if err := pushBackupRepo("final"); err != nil {
			util.Logger().Error("Failed to push final batch",
				zap.Error(err),
			)
		}
	}

	printBackupSummary(repoNames, successCount, skippedCount, failedRepos)
}

// First Ensuring _Repos exist
func ensureReposDirExists() error {
	cmd := exec.Command("mkdir", "-p", "_Repos")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to create _Repos directory: %v: %s", err, string(out))
	}

	return nil
}


func processDeletedRepos(currentRepoNames []string, config *model.ConfigModel, db *sql.DB) {
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

	deletedCount := 0
	for _, dbRepo := range dbRepos {
		if !currentSet[dbRepo.FullName] {
			util.Logger().Info("Repository no longer on GitHub; removing",
				zap.String("repository", dbRepo.FullName),
			)

			repoName := extractRepoName(dbRepo.FullName)
			cleanupExistingRepo(repoName)

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

			commitMsg := sanitizeCommitMessage(fmt.Sprintf("Removed deleted repo %s on %s",
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
		if err := pushBackupRepo("deleted-repos-cleanup"); err != nil {
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

func ensureBackupRepoInitialized(config *model.ConfigModel) error {
	// Check if _Repos/.git already exists
	if _, err := os.Stat("_Repos/.git"); err == nil {
		util.Logger().Info("Backup repository already initialized; skipping init")

		// Make sure the remote URL is up to date
		if config.BackupRepoPath != "" {
			updateRemoteCmd := exec.Command("sh", "-c",
				fmt.Sprintf("cd _Repos && git remote set-url origin '%s' 2>/dev/null || git remote add origin '%s'",
					config.BackupRepoPath, config.BackupRepoPath))
			if out, err := updateRemoteCmd.CombinedOutput(); err != nil {
				util.Logger().Warn("Failed to update remote URL",
					zap.Error(err),
					zap.String("output", string(out)),
				)
			}
		}

		return nil
	}

	// Fresh init — first time setup
	backupRepoPath := config.BackupRepoPath
	if backupRepoPath == "" {
		return fmt.Errorf("BACKUP_REPO_PATH is not set; cannot initialize backup repository")
	}

	initScript := buildInitScript(backupRepoPath)
	return retryCommand(func() *exec.Cmd {
		return exec.Command("sh", "-c", initScript)
	}, "Initial git setup", pushTimeout)
}

func buildInitScript(backupRepoPath string) string {
	return fmt.Sprintf(`cd _Repos && \
		git init && \
		git config user.email "shardendumishra01@gmail.com" && \
		git config user.name "ShardenduMishra22" && \
		git checkout -B main && \
		touch README.md && \
		git add README.md && \
		git commit -m 'init: Initial commit' -s && \
		git remote add origin '%s' && \
		git push origin main && \
		cd ..`, backupRepoPath)
}

func extractRepoName(fullName string) string {
	return fullName[strings.Index(fullName, "/")+1:]
}

func buildCloneURL(fullName string) string {
	return fmt.Sprintf("git@github.com-project:%s.git", fullName)
}

func getRemoteHeadHash(repoURL string) (string, error) {
	out, err := exec.Command("git", "ls-remote", repoURL, "HEAD").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git ls-remote failed: %v: %s", err, strings.TrimSpace(string(out)))
	}

	fields := strings.Fields(string(out))
	if len(fields) == 0 {
		return "", fmt.Errorf("git ls-remote returned no hash")
	}

	return fields[0], nil
}

func cleanupExistingRepo(repoName string) {
	cleanupCmd := exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && rm -rf '%s.git' '%s.tar.gz'", repoName, repoName))
	if _, err := cleanupCmd.CombinedOutput(); err != nil {
		util.Logger().Warn("Repository cleanup failed",
			zap.String("repository", repoName),
			zap.Error(err),
		)
	}
}

func cloneRepo(url string, repoName string) error {
	return retryCommand(func() *exec.Cmd {
		return exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && git clone --bare --depth=1 '%s' '%s.git'", url, repoName))
	}, fmt.Sprintf("Clone %s", repoName), cloneTimeout)
}

func archiveRepo(repoName string) error {
	repoDir := fmt.Sprintf("%s.git", repoName)
	archiveName := fmt.Sprintf("%s.tar.gz", repoName)

	return retryCommand(func() *exec.Cmd {
		return exec.Command(
			"sh",
			"-c",
			fmt.Sprintf(
				"cd _Repos && tar -czf '%s' '%s' && rm -rf '%s'",
				archiveName,
				repoDir,
				repoDir,
			),
		)
	}, fmt.Sprintf("Archive %s", repoName), cloneTimeout)
}

func buildCommitMessage(repoName string) string {
	return sanitizeCommitMessage(fmt.Sprintf("Backup Added on %s for the repo %s",
		time.Now().Format("2006-01-02 Monday 15:04:05"),
		repoName))
}

func stageAndCommitRepo(repoName string, commitMsg string) {
	commitCmd := exec.Command("sh", "-c",
		fmt.Sprintf("cd _Repos && git add '%s' && "+
			"if git diff --staged --quiet; then "+
			"  echo 'no changes'; "+
			"else "+
			"  git commit -m '%s' -s; "+
			"fi", repoName, commitMsg))

	if _, err := commitCmd.CombinedOutput(); err != nil {
		util.Logger().Warn("Commit failed",
			zap.String("repository", repoName),
			zap.Error(err),
		)
	}
}

func pushBackupRepo(label string) error {
	return retryCommand(func() *exec.Cmd {
		return exec.Command("sh", "-c", "cd _Repos && git push origin main")
	}, fmt.Sprintf("Push (%s)", label), pushTimeout)
}
