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

	CloneRepos(allRepos, config)
}

func CloneRepos(repoNames []string, config *model.ConfigModel) {
    repoCount := 1
    
    // Clean and reinitialize _Repos directory for each run
    cmdCleanRepos := exec.Command("sh", "-c", "rm -rf _Repos && mkdir -p _Repos")
    if out, err := cmdCleanRepos.CombinedOutput(); err != nil {
        util.ErrorHandler(fmt.Errorf("failed to clean _Repos directory: %v: %s", err, string(out)))
    }

    // Initialize git repo with proper remote setup
    initScript := `
        cd _Repos && 
        git init && 
        git config user.email "backup@example.com" && 
        git config user.name "GitHub Backup" && 
        git checkout -b main && 
        touch README.md && 
        git add README.md && 
        git commit -m 'Initial commit' && 
        git remote add origin git@github.com-learning:ShardenduMishra22/MishraShardendu22-Backup.git && 
        git push --force origin main && 
        cd ..
    `
    cmd1 := exec.Command("sh", "-c", initScript)
    if out, err := cmd1.CombinedOutput(); err != nil {
        util.ErrorHandler(fmt.Errorf("initial git setup failed: %v: %s", err, string(out)))
    }

    for _, fullName := range repoNames {
        url := "git@github.com:" + fullName + ".git"
        repoName := fullName[strings.Index(fullName, "/")+1:]
        repoPath := "_Repos/" + repoName

        // Clone repo
        cmdClone := exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && rm -rf \"%s\" && git clone %s", repoName, url))
        if out, err := cmdClone.CombinedOutput(); err != nil {
            util.ErrorHandler(fmt.Errorf("git clone failed for %s: %v: %s", url, err, string(out)))
            continue
        }

        // Remove .git directory
        cmdRemoveGit := exec.Command("sh", "-c", fmt.Sprintf("cd %s && rm -rf .git", repoPath))
        if out, err := cmdRemoveGit.CombinedOutput(); err != nil {
            util.ErrorHandler(fmt.Errorf("failed to remove .git in %s: %v: %s", repoPath, err, string(out)))
        }

        // Add, commit, and push
        commitMsg := fmt.Sprintf("Backup Added on %s for the repo %s", time.Now().Format("2006-01-02 Monday 15:04:05"), repoName)
        cmdCommit := exec.Command("sh", "-c", fmt.Sprintf("cd _Repos && git add \"%s\" && if git diff --staged --quiet; then echo 'no changes'; else git commit -m \"%s\"; fi", repoName, commitMsg))
        if out, err := cmdCommit.CombinedOutput(); err != nil {
            util.ErrorHandler(fmt.Errorf("git add/commit failed for %s: %v: %s", repoName, err, string(out)))
        }

        // Verify remote before push
        cmdVerifyRemote := exec.Command("sh", "-c", "cd _Repos && git remote -v")
        if out, err := cmdVerifyRemote.CombinedOutput(); err == nil {
            fmt.Printf("Current remote: %s\n", string(out))
        }

        // Push to backup repo
        cmdPush := exec.Command("sh", "-c", "cd _Repos && git push origin main")
        if out, err := cmdPush.CombinedOutput(); err != nil {
            util.ErrorHandler(fmt.Errorf("git push failed for repo %s: %v: %s", repoName, err, string(out)))
            continue
        }

        fmt.Printf("Repo Count: %d - %s backed up successfully\n", repoCount, repoName)
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
