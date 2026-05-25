package service

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

const (
	maxRetries   = 3
	pushTimeout  = 5 * time.Minute
	baseDelay    = 2 * time.Second
	cloneTimeout = 10 * time.Minute
	repoDelay    = 300 * time.Millisecond
)

// Older version
// func sanitizeShellArg(arg string) string {
// 	reg := regexp.MustCompile(`[^\w\s\-\/.]`)
// 	return reg.ReplaceAllString(arg, "")
// }

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

func CloneRepos(repoNames []string, config *model.ConfigModel) {
	successCount := 0
	failedRepos := []string{}

	if err := prepareReposDir(); err != nil {
		util.ErrorHandler(err)
		return
	}

	defer backupAndCleanup()

	if err := setupInitialBackupRepo(); err != nil {
		util.ErrorHandler(err)
		return
	}

	util.Logger().Info("Starting repository backup")

	for idx, fullName := range repoNames {
		if idx > 0 {
			time.Sleep(repoDelay)
		}

		repoName := extractRepoName(fullName)
		// repoPath := buildRepoPath(repoName)
		url := buildCloneURL(fullName)

		util.Logger().Info("Processing repository",
			zap.Int("current", idx+1),
			zap.Int("total", len(repoNames)),
			zap.String("repository", fullName),
		)

		cleanupExistingRepo(repoName)

		if err := cloneRepo(url, repoName); err != nil {
			util.Logger().Error("Failed to clone repository",
				zap.String("repository", fullName),
				zap.Error(err),
			)
			failedRepos = append(failedRepos, fullName)
			continue
		}

		// Older version
		// removeGitMetadata(repoPath)
		// commitMsg := buildCommitMessage(repoName)
		// stageAndCommitRepo(repoName, commitMsg)

		if err := archiveRepo(repoName); err != nil {
			util.Logger().Error("Failed to archive repository",
				zap.String("repository", fullName),
				zap.Error(err),
			)

			failedRepos = append(failedRepos, fullName)
			continue
		}

		commitMsg := buildCommitMessage(repoName)

		stageAndCommitRepo(
			fmt.Sprintf("%s.tar.gz", repoName),
			commitMsg,
		)

		if err := pushBackupRepo(repoName); err != nil {
			util.Logger().Error("Failed to push repository backup",
				zap.String("repository", fullName),
				zap.Error(err),
			)
			failedRepos = append(failedRepos, fullName)
			continue
		}

		successCount++
		util.Logger().Info("Successfully backed up repository",
			zap.String("repository", fullName),
			zap.Int("successful", successCount),
			zap.Int("total", len(repoNames)),
		)
	}

	printBackupSummary(repoNames, successCount, failedRepos)
}

func prepareReposDir() error {
	cmdCleanRepos := exec.Command("sh", "-c", "rm -rf _Repos && mkdir -p _Repos")
	if out, err := cmdCleanRepos.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to clean _Repos directory: %v: %s", err, string(out))
	}

	return nil
}

func backupAndCleanup() {
	util.Logger().Info("Creating local backup")
	backupCmd := exec.Command("sh", "-c", "rm -rf backup && mkdir -p backup && cp -r _Repos/* backup/")
	if out, err := backupCmd.CombinedOutput(); err != nil {
		util.Logger().Warn("Failed to create local backup",
			zap.Error(err),
			zap.String("output", string(out)),
		)
	} else {
		util.Logger().Info("Successfully created local backup",
			zap.String("folder", "backup"),
		)
	}

	util.Logger().Info("Cleaning up")
	cleanupCmd := exec.Command("sh", "-c", "rm -rf _Repos")
	if out, err := cleanupCmd.CombinedOutput(); err != nil {
		util.Logger().Warn("Failed to cleanup repository workspace",
			zap.Error(err),
			zap.String("output", string(out)),
		)
	} else {
		util.Logger().Info("Successfully removed repository workspace",
			zap.String("directory", "_Repos"),
		)
	}
}

func setupInitialBackupRepo() error {
	initScript := buildInitScript()
	return retryCommand(func() *exec.Cmd {
		return exec.Command("sh", "-c", initScript)
	}, "Initial git setup", pushTimeout)
}

func buildInitScript() string {
	return `cd _Repos && \
		git init && \
		git config user.email "shardendumishra01@gmail.com" && \
		git config user.name "ShardenduMishra22" && \
		git checkout -B main && \
		touch README.md && \
		git add README.md && \
		git commit -m 'Initial commit' -s -S && \
		git remote add origin git@github.com-learning:ShardenduMishra22/MishraShardendu22-Backup.git && \
		git push --force origin main && \
		cd ..`
}

func extractRepoName(fullName string) string {
	return fullName[strings.Index(fullName, "/")+1:]
}

// func buildRepoPath(repoName string) string {
// 	return "_Repos/" + sanitizeShellArg(repoName)
// }

func buildCloneURL(fullName string) string {
	return fmt.Sprintf("git@github.com-project:%s.git", fullName)
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
		return exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && git clone --progress --mirror '%s' '%s.git'", url, repoName))
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

// Older version needed to remove .git folder to avoid nested git repos, but with --mirror clone, it's not needed anymore
// func removeGitMetadata(repoPath string) {
// 	removeGitCmd := exec.Command("sh", "-c", fmt.Sprintf("cd '%s' && rm -rf .git", repoPath))
// 	if _, err := removeGitCmd.CombinedOutput(); err != nil {
// 		util.Logger().Warn("Failed to remove git metadata",
// 			zap.String("path", repoPath),
// 			zap.Error(err),
// 		)
// 	}
// }

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
			"  git commit -m '%s' -s -S; "+
			"fi", repoName, commitMsg))

	if _, err := commitCmd.CombinedOutput(); err != nil {
		util.Logger().Warn("Commit failed",
			zap.String("repository", repoName),
			zap.Error(err),
		)
	}
}

func pushBackupRepo(repoName string) error {
	return retryCommand(func() *exec.Cmd {
		return exec.Command("sh", "-c", "cd _Repos && git push origin main")
	}, fmt.Sprintf("Push %s", repoName), pushTimeout)
}
