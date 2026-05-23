package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/controller"
	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/util"
	"github.com/joho/godotenv"
)

const (
	maxRetries   = 3
	pushTimeout  = 5 * time.Minute
	baseDelay    = 2 * time.Second
	cloneTimeout = 10 * time.Minute
	repoDelay    = 300 * time.Millisecond
)

func main() {
	fmt.Println("Hello from GitHub Backup Script")
	runBackupFlow()
}

func runBackupFlow() {
	config := loadConfig()
	urls := ImportantURL(config)

	allRepos := GetAllRepos(config, urls)
	fmt.Println("The Amount of repos is:", len(allRepos))

	printRepoList(allRepos)
	CloneRepos(allRepos, config)
}

func printRepoList(repos []string) {
	for _, repo := range repos {
		fmt.Println(repo)
	}
}

func sanitizeShellArg(arg string) string {
	reg := regexp.MustCompile(`[^\w\s\-\/\.]`)
	return reg.ReplaceAllString(arg, "")
}

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
				fmt.Printf("[ATTEMPT %d/%d] %s timed out. Retrying in %v...\n",
					attempt, maxRetries, operation, delay)
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
				fmt.Printf("[ATTEMPT %d/%d] %s failed (transient error). Retrying in %v...\n",
					attempt, maxRetries, operation, delay)
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

	fmt.Print("\n=== Starting Repository Backup ===\n")

	for idx, fullName := range repoNames {
		if idx > 0 {
			time.Sleep(repoDelay)
		}

		repoName := extractRepoName(fullName)
		repoPath := buildRepoPath(repoName)
		url := buildCloneURL(fullName)

		fmt.Printf("[%d/%d] Processing: %s\n", idx+1, len(repoNames), fullName)

		cleanupExistingRepo(repoName)

		if err := cloneRepo(url, repoName); err != nil {
			fmt.Printf("  ✗ Failed to clone: %v\n", err)
			failedRepos = append(failedRepos, fullName)
			continue
		}

		removeGitMetadata(repoPath)

		commitMsg := buildCommitMessage(repoName)
		stageAndCommitRepo(repoName, commitMsg)

		if err := pushBackupRepo(repoName); err != nil {
			fmt.Printf("  ✗ Failed to push: %v\n", err)
			failedRepos = append(failedRepos, fullName)
			continue
		}

		successCount++
		fmt.Printf("  ✓ Successfully backed up (%d/%d successful)\n\n", successCount, len(repoNames))
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
	fmt.Println("\n=== Creating local backup ===")
	backupCmd := exec.Command("sh", "-c", "rm -rf backup && mkdir -p backup && cp -r _Repos/* backup/")
	if out, err := backupCmd.CombinedOutput(); err != nil {
		fmt.Printf("⚠ Warning: failed to create backup: %v: %s\n", err, string(out))
	} else {
		fmt.Println("✓ Successfully created local backup in 'backup' folder")
	}

	fmt.Println("\n=== Cleaning up ===")
	cleanupCmd := exec.Command("sh", "-c", "rm -rf _Repos")
	if out, err := cleanupCmd.CombinedOutput(); err != nil {
		fmt.Printf("⚠ Warning: failed to cleanup _Repos: %v: %s\n", err, string(out))
	} else {
		fmt.Println("✓ Successfully removed _Repos directory")
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
		git cm 'Initial commit' && \
		git remote add origin git@github.com-learning:ShardenduMishra22/MishraShardendu22-Backup.git && \
		git push --force origin main && \
		cd ..`
}

func extractRepoName(fullName string) string {
	return fullName[strings.Index(fullName, "/")+1:]
}

func buildRepoPath(repoName string) string {
	return "_Repos/" + sanitizeShellArg(repoName)
}

func buildCloneURL(fullName string) string {
	return fmt.Sprintf("git@github.com-project:%s.git", fullName)
}

func cleanupExistingRepo(repoName string) {
	cleanupCmd := exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && rm -rf '%s'", repoName))
	if _, err := cleanupCmd.CombinedOutput(); err != nil {
		fmt.Printf("  ⚠ Warning: cleanup failed: %v\n", err)
	}
}

func cloneRepo(url string, repoName string) error {
	return retryCommand(func() *exec.Cmd {
		return exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && git clone --progress '%s'", url))
	}, fmt.Sprintf("Clone %s", repoName), cloneTimeout)
}

func removeGitMetadata(repoPath string) {
	removeGitCmd := exec.Command("sh", "-c", fmt.Sprintf("cd '%s' && rm -rf .git", repoPath))
	if _, err := removeGitCmd.CombinedOutput(); err != nil {
		fmt.Printf("  ⚠ Warning: failed to remove .git: %v\n", err)
	}
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
			"  git cm '%s'; "+
			"fi", repoName, commitMsg))

	if _, err := commitCmd.CombinedOutput(); err != nil {
		fmt.Printf("  ⚠ Warning: commit failed: %v\n", err)
	}
}

func pushBackupRepo(repoName string) error {
	return retryCommand(func() *exec.Cmd {
		return exec.Command("sh", "-c", "cd _Repos && git push origin main")
	}, fmt.Sprintf("Push %s", repoName), pushTimeout)
}

func printBackupSummary(repoNames []string, successCount int, failedRepos []string) {
	fmt.Println("\n=== Backup Summary ===")
	fmt.Printf("Total repos: %d\n", len(repoNames))
	fmt.Printf("Successful: %d\n", successCount)
	fmt.Printf("Failed: %d\n", len(failedRepos))

	if len(failedRepos) > 0 {
		fmt.Println("\nFailed repositories:")
		for _, repo := range failedRepos {
			fmt.Printf("  - %s\n", repo)
		}
	}
}

func GetAllRepos(config *model.ConfigModel, urls *model.URL) []string {
	orgReposPersonal := controller.RepoController(urls.GetAllOrgRepos, *config)
	publicReposPersonal := controller.RepoController(urls.GetAllPublicRepos, *config)
	privatePersonalAndOrgReops := controller.RepoControllerPrivate(urls.GetAllPrivateRepos, *config)

	var allRepos []string
	allRepos = append(allRepos, orgReposPersonal...)
	fmt.Println("Org repos count:", len(orgReposPersonal))

	allRepos = append(allRepos, publicReposPersonal...)
	fmt.Println("Public repos count:", len(publicReposPersonal))

	allRepos = append(allRepos, privatePersonalAndOrgReops...)
	fmt.Println("Private repos count:", len(privatePersonalAndOrgReops))

	return allRepos
}

func loadConfig() *model.ConfigModel {
	return &model.ConfigModel{
		OrgAccount:          util.GetEnv("ORG_ACCOUNT", ""),
		MainAccount:         util.GetEnv("MAIN_ACCOUNT", ""),
		ProjectAccount:      util.GetEnv("PROJECT_ACCOUNT", ""),
		BackupRepoPath:      util.GetEnv("BACKUP_REPO_PATH", ""),
		GitHubTokenPrivate:  util.GetEnv("GITHUB_TOKEN_PERSONAL", ""),
		GitHubTokenPersonal: util.GetEnv("GITHUB_TOKEN_PERSONAL", ""),
	}
}

func ImportantURL(config *model.ConfigModel) *model.URL {
	return &model.URL{
		GetAllPrivateRepos: "https://api.github.com/user/repos?type=private&per_page=100&page=1",
		GetAllOrgRepos:     "https://api.github.com/orgs/" + config.OrgAccount + "/repos?type=all&per_page=50&page=",
		GetAllPublicRepos:  "https://api.github.com/users/" + config.ProjectAccount + "/repos?type=public&per_page=50&page=",
	}
}

func init() {
	currEnv := "development"

	if currEnv == "development" {
		if err := godotenv.Load(); err != nil {
			log.Printf("Warning: error loading .env file: %v", err)
		}
	}
}
