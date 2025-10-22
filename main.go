package main

import (
	"fmt"
	"log"
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
	maxRetries = 3
	baseDelay  = 2 * time.Second
	repoDelay  = 300 * time.Millisecond
)

func main() {
	fmt.Println("Hello from GitHub Backup Script")
	config := loadConfig()
	urls := ImportantURL(config)

	var allRepos []string
	allRepos = GetAllRepos(config, urls)
	fmt.Println("The Amount of repos is:", len(allRepos))

	for _, repo := range allRepos {
		fmt.Println(repo)
	}

	CloneRepos(allRepos, config)
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

// retryCommand executes command with exponential backoff retry logic
func retryCommand(cmdFunc func() *exec.Cmd, operation string) error {
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		cmd := cmdFunc()
		output, err := cmd.CombinedOutput()

		if err == nil {
			return nil
		}

		lastErr = fmt.Errorf("%s: %v: %s", operation, err, string(output))

		// Check if it's a transient error worth retrying
		outputStr := string(output)
		isTransient := strings.Contains(outputStr, "Could not resolve hostname") ||
			strings.Contains(outputStr, "Connection reset") ||
			strings.Contains(outputStr, "Connection timed out") ||
			strings.Contains(outputStr, "temporary failure")

		if !isTransient {
			// Not a transient error, don't retry
			return lastErr
		}

		if attempt < maxRetries {
			delay := baseDelay * time.Duration(1<<uint(attempt-1))
			fmt.Printf("[ATTEMPT %d/%d] %s failed (transient error). Retrying in %v...\n",
				attempt, maxRetries, operation, delay)
			time.Sleep(delay)
		}
	}

	return fmt.Errorf("%s failed after %d attempts: %v", operation, maxRetries, lastErr)
}

func CloneRepos(repoNames []string, config *model.ConfigModel) {
	successCount := 0
	failedRepos := []string{}

	// Clean and create _Repos directory
	cmdCleanRepos := exec.Command("sh", "-c", "rm -rf _Repos && mkdir -p _Repos")
	if out, err := cmdCleanRepos.CombinedOutput(); err != nil {
		util.ErrorHandler(fmt.Errorf("failed to clean _Repos directory: %v: %s", err, string(out)))
		return
	}

	// Initialize git repository
	initScript := `cd _Repos && \
        git init && \
        git config user.email "shardendumishra01@gmail.com" && \
        git config user.name "ShardenduMishra22" && \
        git checkout -b main && \
        touch README.md && \
        git add README.md && \
        git commit -m 'Initial commit' && \
        git remote add origin git@github.com-learning:ShardenduMishra22/MishraShardendu22-Backup.git && \
        git push --force origin main && \
        cd ..`

	err := retryCommand(func() *exec.Cmd {
		return exec.Command("sh", "-c", initScript)
	}, "Initial git setup")

	if err != nil {
		util.ErrorHandler(err)
		return
	}

	fmt.Print("\n=== Starting Repository Backup ===\n")

	for idx, fullName := range repoNames {
		if idx > 0 {
			time.Sleep(repoDelay)
		}

		repoName := fullName[strings.Index(fullName, "/")+1:]
		repoPath := "_Repos/" + sanitizeShellArg(repoName)
		url := fmt.Sprintf("git@github.com-project:%s.git", fullName)

		fmt.Printf("[%d/%d] Processing: %s\n", idx+1, len(repoNames), fullName)

		// Cleanup existing directory
		cleanupCmd := exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && rm -rf '%s'", repoName))
		if _, err := cleanupCmd.CombinedOutput(); err != nil {
			fmt.Printf("  ⚠ Warning: cleanup failed: %v\n", err)
		}

		// Clone repository with retry
		err := retryCommand(func() *exec.Cmd {
			return exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && git clone '%s'", url))
		}, fmt.Sprintf("Clone %s", repoName))

		if err != nil {
			fmt.Printf("  ✗ Failed to clone: %v\n", err)
			failedRepos = append(failedRepos, fullName)
			continue
		}

		// Remove .git directory
		removeGitCmd := exec.Command("sh", "-c", fmt.Sprintf("cd '%s' && rm -rf .git", repoPath))
		if _, err := removeGitCmd.CombinedOutput(); err != nil {
			fmt.Printf("  ⚠ Warning: failed to remove .git: %v\n", err)
		}

		// Create commit message with proper escaping
		commitMsg := sanitizeCommitMessage(fmt.Sprintf("Backup Added on %s for the repo %s",
			time.Now().Format("2006-01-02 Monday 15:04:05"),
			repoName))

		// Add and commit changes
		commitCmd := exec.Command("sh", "-c",
			fmt.Sprintf("cd _Repos && git add '%s' && "+
				"if git diff --staged --quiet; then "+
				"  echo 'no changes'; "+
				"else "+
				"  git commit -m '%s'; "+
				"fi", repoName, commitMsg))

		if _, err := commitCmd.CombinedOutput(); err != nil {
			fmt.Printf("  ⚠ Warning: commit failed: %v\n", err)
		}

		// Push with retry
		err = retryCommand(func() *exec.Cmd {
			return exec.Command("sh", "-c", "cd _Repos && git push origin main")
		}, fmt.Sprintf("Push %s", repoName))

		if err != nil {
			fmt.Printf("  ✗ Failed to push: %v\n", err)
			failedRepos = append(failedRepos, fullName)
			continue
		}

		successCount++
		fmt.Printf("  ✓ Successfully backed up (%d/%d successful)\n\n", successCount, len(repoNames))
	}

	// Summary
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
		GitHubTokenMain:     util.GetEnv("GITHUB_TOKEN_MAIN", ""),
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
