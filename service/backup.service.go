package service

import (
	"database/sql"

	"github.com/MishraShardendu22/github-backup/config"
	"github.com/MishraShardendu22/github-backup/controller"
	"github.com/MishraShardendu22/github-backup/database"
	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

func RunBackupFlow(cfg *model.ConfigModel, db *sql.DB) {
	if err := database.MigrateSchema(db); err != nil {
		util.Logger().Warn("Schema migration had issues (non-fatal)", zap.Error(err))
	}

	if err := database.InitSchema(db); err != nil {
		util.ErrorHandler(err)
		return
	}

	if err := database.CleanupExpired(db); err != nil {
		util.ErrorHandler(err)
		return
	}

	urls := config.ImportantURL(cfg)
	allRepos := GetAllRepos(cfg, urls)

	allRepos = deduplicateRepos(allRepos)

	util.Logger().Info("Repositories loaded (after dedup)",
		zap.Int("count", len(allRepos)),
	)

	if len(allRepos) == 0 {
		util.Logger().Warn("No repositories found; nothing to back up")
		return
	}

	printRepoList(allRepos)
	ProcessRepos(allRepos, cfg, db)
}

func GetAllRepos(config *model.ConfigModel, urls *model.URL) []string {
	orgReposPersonal := controller.RepoController(urls.GetAllOrgRepos, *config)
	publicReposPersonal := controller.RepoController(urls.GetAllPublicRepos, *config)
	privatePersonalAndOrgRepos := controller.RepoControllerPrivate(urls.GetAllPrivateRepos, *config)

	var allRepos []string
	allRepos = append(allRepos, orgReposPersonal...)
	util.Logger().Info("Org repositories loaded",
		zap.Int("count", len(orgReposPersonal)),
	)

	allRepos = append(allRepos, publicReposPersonal...)
	util.Logger().Info("Public repositories loaded",
		zap.Int("count", len(publicReposPersonal)),
	)

	allRepos = append(allRepos, privatePersonalAndOrgRepos...)
	util.Logger().Info("Private repositories loaded",
		zap.Int("count", len(privatePersonalAndOrgRepos)),
	)

	return allRepos
}

func deduplicateRepos(repos []string) []string {
	seen := make(map[string]bool, len(repos))
	unique := make([]string, 0, len(repos))

	for _, repo := range repos {
		if !seen[repo] {
			seen[repo] = true
			unique = append(unique, repo)
		}
	}

	if len(repos) != len(unique) {
		util.Logger().Info("Deduplicated repositories",
			zap.Int("before", len(repos)),
			zap.Int("after", len(unique)),
			zap.Int("duplicates_removed", len(repos)-len(unique)),
		)
	}

	return unique
}

func printRepoList(repos []string) {
	for _, repo := range repos {
		util.Logger().Info("Repository discovered",
			zap.String("repository", repo),
		)
	}
}

func printBackupSummary(repoNames []string, successCount int, skippedCount int, failedRepos []string) {
	util.Logger().Info("Backup summary",
		zap.Int("total", len(repoNames)),
		zap.Int("successful", successCount),
		zap.Int("skipped_unchanged", skippedCount),
		zap.Int("failed", len(failedRepos)),
	)

	if len(failedRepos) > 0 {
		for _, repo := range failedRepos {
			util.Logger().Warn("Repository backup failed",
				zap.String("repository", repo),
			)
		}
	}
}
