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
	if err := database.InitSchema(db); err != nil {
		util.ErrorHandler(err)
		return
	}

	if err := database.CleanupExpired(db); err != nil {
		util.ErrorHandler(err)
		return
	}

	hasRepoList, err := database.HasRepoList(db)
	if err != nil {
		util.ErrorHandler(err)
		return
	}

	if hasRepoList {
		pendingRepos, err := database.GetPendingRepos(db)
		if err != nil {
			util.ErrorHandler(err)
			return
		}

		if len(pendingRepos) == 0 {
			util.Logger().Info("Backup already completed in current window; skipping")
			return
		}

		util.Logger().Info("Resuming repository backup",
			zap.Int("count", len(pendingRepos)),
		)

		printRepoList(pendingRepos)
		CloneRepos(pendingRepos, cfg, db)
		return
	}

	urls := config.ImportantURL(cfg)
	allRepos := GetAllRepos(cfg, urls)
	util.Logger().Info("Repositories loaded",
		zap.Int("count", len(allRepos)),
	)

	if err := database.ResetRepoState(db); err != nil {
		util.ErrorHandler(err)
		return
	}

	if err := database.SeedRepoList(db, allRepos); err != nil {
		util.ErrorHandler(err)
		return
	}

	printRepoList(allRepos)
	CloneRepos(allRepos, cfg, db)
}

func GetAllRepos(config *model.ConfigModel, urls *model.URL) []string {
	orgReposPersonal := controller.RepoController(urls.GetAllOrgRepos, *config)
	publicReposPersonal := controller.RepoController(urls.GetAllPublicRepos, *config)
	privatePersonalAndOrgReops := controller.RepoControllerPrivate(urls.GetAllPrivateRepos, *config)

	var allRepos []string
	allRepos = append(allRepos, orgReposPersonal...)
	util.Logger().Info("Org repositories loaded",
		zap.Int("count", len(orgReposPersonal)),
	)

	allRepos = append(allRepos, publicReposPersonal...)
	util.Logger().Info("Public repositories loaded",
		zap.Int("count", len(publicReposPersonal)),
	)

	allRepos = append(allRepos, privatePersonalAndOrgReops...)
	util.Logger().Info("Private repositories loaded",
		zap.Int("count", len(privatePersonalAndOrgReops)),
	)

	return allRepos
}

func printRepoList(repos []string) {
	for _, repo := range repos {
		util.Logger().Info("Repository discovered",
			zap.String("repository", repo),
		)
	}
}

func printBackupSummary(repoNames []string, successCount int, failedRepos []string) {
	util.Logger().Info("Backup summary",
		zap.Int("total", len(repoNames)),
		zap.Int("successful", successCount),
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
