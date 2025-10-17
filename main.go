package main

import (
	"fmt"
	"log"
	"os/exec"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/controller"
	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/util"
	"github.com/joho/godotenv"
)

func main() {
	fmt.Println("Hello from GitHub Backup Script")
	config := loadConfig()
	urls := ImportantURL(config)

	var allRepos []string
	allRepos = GetAllRepos(config, urls)
	fmt.Println("The Amount of repos is: ",len(allRepos))

	for _, repo := range allRepos {
		fmt.Println(repo)
	}
	
	// CloneRepos(allRepos, config)
}

func CloneRepos(repoNames []string, config *model.ConfigModel) {
	repoCount := 1
	cmd1 := exec.Command("sh", "-c", "cd _Repos && git init && (git checkout -b main || git checkout main || true) && if [ -z \"$(git rev-parse --verify HEAD 2>/dev/null)\" ]; then touch README.md && git add README.md && git commit -m 'Initial commit'; fi && (git remote get-url origin >/dev/null 2>&1 && git remote set-url origin git@github.com-learning:ShardenduMishra22/MishraShardendu22-Backup.git || git remote add origin git@github.com-learning:ShardenduMishra22/MishraShardendu22-Backup.git) && git push --force origin main && cd ..")
	if out, err := cmd1.CombinedOutput(); err != nil {
		util.ErrorHandler(fmt.Errorf("initial git setup failed: %v: %s", err, string(out)))
	}

	for _, fullName := range repoNames {
		url := "git@github.com:" + fullName + ".git"

		repoName := fullName[strings.Index(fullName, "/")+1:]

		repoPath := "_Repos/" + repoName

		// remove existing folder if present to ensure a clean clone
		cmdCleanup := exec.Command("sh", "-c", "rm -rf \""+repoPath+"\"")
		if out, err := cmdCleanup.CombinedOutput(); err != nil {
			util.ErrorHandler(fmt.Errorf("failed to cleanup existing repo path %s: %v: %s", repoPath, err, string(out)))
		}

		cmd1 := exec.Command("sh", "-c", "cd _Repos && git clone "+url)
		if out, err := cmd1.CombinedOutput(); err != nil {
			util.ErrorHandler(fmt.Errorf("git clone failed for %s: %v: %s", url, err, string(out)))
		}

		cmd2 := exec.Command("sh", "-c", "cd "+repoPath+" && rm -rf .git")
		if out, err := cmd2.CombinedOutput(); err != nil {
			util.ErrorHandler(fmt.Errorf("failed to remove .git in %s: %v: %s", repoPath, err, string(out)))
		}

		commitMsg := "Backup Added on " + time.Now().Format("2006-01-02 Monday 15:04:05") + " for the repo " + repoName
		cmd3 := exec.Command("sh", "-c", "cd _Repos && git add \""+repoName+"\" && if git diff --staged --quiet; then echo 'no changes to commit'; else git commit -m \""+commitMsg+"\"; fi")
		if out, err := cmd3.CombinedOutput(); err != nil {
			util.ErrorHandler(fmt.Errorf("git add/commit failed for %s: %v: %s", repoName, err, string(out)))
		}

		cmd4 := exec.Command("sh", "-c", "cd _Repos && git push origin main")
		if out, err := cmd4.CombinedOutput(); err != nil {
			util.ErrorHandler(fmt.Errorf("git push failed in _Repos: %v: %s", err, string(out)))
		}

		fmt.Println("Repo Count: ", repoCount)
		repoCount++
	}
}

func GetAllRepos(config *model.ConfigModel, urls *model.URL) []string {
	orgReposPersonal := controller.RepoController(urls.GetAllOrgRepos, *config)
	publicReposPersonal := controller.RepoController(urls.GetAllPublicRepos, *config)
	privatePersonalAndOrgReops := controller.RepoControllerPrivate(urls.GetAllPrivateRepos, *config)

	var allRepos []string
	allRepos = append(allRepos, orgReposPersonal...)
	fmt.Println("Org repos count: ", len(orgReposPersonal))

	allRepos = append(allRepos, publicReposPersonal...)
	fmt.Println("Public repos count: ", len(publicReposPersonal))

	allRepos = append(allRepos, privatePersonalAndOrgReops...)
	fmt.Println("Private repos count: ", len(privatePersonalAndOrgReops))

	return allRepos
}

func loadConfig() *model.ConfigModel {
	return &model.ConfigModel{
		OrgAccount:          util.GetEnv("ORG_ACCOUNT", ""),
		MainAccount:         util.GetEnv("MAIN_ACCOUNT", ""),
		ProjectAccount:      util.GetEnv("PROJECT_ACCOUNT", ""),
		BackupRepoPath:      util.GetEnv("BACKUP_REPO_PATH", ""),
		GithubTokenPrivate:  util.GetEnv("GITHUB_TOKEN_PERSONAL", ""),
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
