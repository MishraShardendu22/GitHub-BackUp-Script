package helper

import (
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
	pushTimeout  = 20 * time.Minute
	cloneTimeout = 20 * time.Minute
)

func EnsureReposDirExists() error {
	cmd := exec.Command("mkdir", "-p", "_Repos")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to create _Repos directory: %v: %s", err, string(out))
	}

	return nil
}

func EnsureBackupRepoInitialized(config *model.ConfigModel) error {
	if _, err := os.Stat("_Repos/.git"); err == nil {
		util.Logger().Info("Backup repository already initialized; skipping init")

		if config.BackupRepoPath != "" {
			// Try updating existing remote.
			// If remote doesn't exist - create it.
			updateRemoteCmd := exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && git remote set-url origin '%s' 2>/dev/null || git remote add origin '%s'", config.BackupRepoPath, config.BackupRepoPath))
			if out, err := updateRemoteCmd.CombinedOutput(); err != nil {
				util.Logger().Warn("Failed to update remote URL",
					zap.Error(err),
					zap.String("output", string(out)),
				)
			}
		}

		return nil
	}

	backupRepoPath := config.BackupRepoPath
	if backupRepoPath == "" {
		return fmt.Errorf("BACKUP_REPO_PATH is not set; cannot initialize backup repository")
	}

	initScript := buildInitScript(backupRepoPath)
	return retryCommand(func() *exec.Cmd {
		return exec.Command("sh", "-c", initScript)
	}, "Initial git setup", pushTimeout)
}

func GetRemoteHeadHash(repoURL string) (string, error) {
	// get latest hash
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

func CleanupExistingRepo(repoName string) {
	cleanupCmd := exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && rm -rf '%s' '%s.tar.gz'", repoName, repoName))
	if _, err := cleanupCmd.CombinedOutput(); err != nil {
		util.Logger().Warn("Repository cleanup failed",
			zap.String("repository", repoName),
			zap.Error(err),
		)
	}
}

func CloneRepo(url string, repoName string) error {
	return retryCommand(func() *exec.Cmd {
		// Shallow clone the working tree (non-bare) and remove the .git directory so only the latest code remains
		return exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && git clone --depth=1 '%s' '%s' && rm -rf '%s/.git'", url, repoName, repoName))
	}, fmt.Sprintf("Clone %s", repoName), cloneTimeout)
}

func ArchiveRepo(repoName string) error {
	repoDir := fmt.Sprintf("%s", repoName)
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

func StageAndCommitRepo(repoName string, commitMsg string) {
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

func PushBackupRepo(label string) error {
	return retryCommand(func() *exec.Cmd {
		cmd := exec.Command(
			"git",
			"-c", "core.compression=0",
			"push",
			"origin",
			"main",
		)

		cmd.Dir = "_Repos"
		return cmd
	}, fmt.Sprintf("Push (%s)", label), pushTimeout)
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
		git push origin main || (git pull --no-rebase --allow-unrelated-histories origin main --no-edit && git push origin main) && \
		cd ..`, backupRepoPath)
}
