package config

import (
	"github.com/MishraShardendu22/github-backup/backup-worker/model"
	"github.com/MishraShardendu22/github-backup/backup-worker/util"
	"github.com/joho/godotenv"
)

func LoadEnv() {
	currEnv := "development"

	if currEnv == "development" {
		// 1. Try local service .env (.env)
		if err := godotenv.Load(".env"); err == nil {
			return
		}

		// 2. Try root-level .env (../.env)
		if err := godotenv.Load("../.env"); err == nil {
			return
		}

		// 3. If neither file exists, log warning only if key variables are missing
		dbURL := util.GetEnv("DATABASE_URL", util.GetEnv("POSTGRES_URL", ""))
		if dbURL == "" && util.GetEnv("GITHUB_TOKEN_PERSONAL", "") == "" {
			util.Logger().Warn("No .env file found in service directory (.env) or parent root (../.env)")
		}
	}
}

func LoadConfig() *model.ConfigModel {
	dbURL := util.GetEnv("DATABASE_URL", util.GetEnv("POSTGRES_URL", ""))
	return &model.ConfigModel{
		OrgAccount:          util.GetEnv("ORG_ACCOUNT", ""),
		PostgreSql:          dbURL,
		DatabaseURL:         dbURL,
		DBPath:              util.GetEnv("DB_PATH", "./app.db"),
		ProjectAccount:      util.GetEnv("PROJECT_ACCOUNT", ""),
		BackupRepoPath:      util.GetEnv("BACKUP_REPO_PATH", ""),
		GitHubTokenPrivate:  util.GetEnv("GITHUB_TOKEN_PRIVATE", ""),
		GitHubTokenPersonal: util.GetEnv("GITHUB_TOKEN_PERSONAL", ""),
	}
}

func ImportantURL(config *model.ConfigModel) *model.URL {
	return &model.URL{
		GetAllPrivateRepos: "https://api.github.com/user/repos?type=private&per_page=100&page=",
		GetAllOrgRepos:     "https://api.github.com/orgs/" + config.OrgAccount + "/repos?type=all&per_page=50&page=",
		GetAllPublicRepos:  "https://api.github.com/users/" + config.ProjectAccount + "/repos?type=public&per_page=50&page=",
	}
}
