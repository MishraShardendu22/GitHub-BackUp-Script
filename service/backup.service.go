package service

import (
	"database/sql"
	"sync"

	"github.com/MishraShardendu22/github-backup/config"
	"github.com/MishraShardendu22/github-backup/controller"
	"github.com/MishraShardendu22/github-backup/database"
	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/service/collect"
	"github.com/MishraShardendu22/github-backup/service/monitor"
	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

/* start and run the backup flow */
func RunBackupFlow(cfg *model.ConfigModel, db *sql.DB) {
	// usually not required after first run since they exist
	if err := database.InitSchema(db); err != nil {
		util.ErrorHandler(err)
		return
	}

	// clean the expired logs
	if err := database.CleanupExpired(db); err != nil {
		util.ErrorHandler(err)
		return
	}

	// get the urls
	urls := config.ImportantURL(cfg)

	// get all repos and remove duplicates
	allRepos := GetAllRepos(cfg, urls)
	allRepos = deduplicateRepos(allRepos)

	util.Logger().Info("Repositories loaded (after dedup)",
		zap.Int("count", len(allRepos)),
	)

	if len(allRepos) == 0 {
		util.Logger().Warn("No repositories found; nothing to back up")
		return
	}

	// print repos then send to processing
	printRepoList(allRepos)
	ProcessRepos(allRepos, cfg, db)
}

/*
Get all the repos concurrently (maybe parallely)
If:
- machine has multiple CPU cores (almost certainly yes).
- GOMAXPROCS is greater than 1 (default is number of available CPUs).
- The Go scheduler chooses to run the goroutines on different OS threads.
Then the goroutines may execute in parallel.
*/
func GetAllRepos(config *model.ConfigModel, urls *model.URL) []string {
	var wg sync.WaitGroup

	var orgRepos []string
	var publicRepos []string
	var privateRepos []string

	wg.Add(3)

	go func() {
		defer wg.Done()
		orgRepos = controller.RepoController(urls.GetAllOrgRepos, *config)
	}()

	go func() {
		defer wg.Done()
		publicRepos = controller.RepoController(urls.GetAllPublicRepos, *config)
	}()

	go func() {
		defer wg.Done()
		privateRepos = controller.RepoControllerPrivate(urls.GetAllPrivateRepos, *config)
	}()

	wg.Wait()

	util.Logger().Info("Org repositories loaded",
		zap.Int("count", len(orgRepos)),
	)

	util.Logger().Info("Public repositories loaded",
		zap.Int("count", len(publicRepos)),
	)

	util.Logger().Info("Private repositories loaded",
		zap.Int("count", len(privateRepos)),
	)

	allRepos := make([]string, 0,
		len(orgRepos)+len(publicRepos)+len(privateRepos))

	allRepos = append(allRepos, orgRepos...)
	allRepos = append(allRepos, publicRepos...)
	allRepos = append(allRepos, privateRepos...)

	return allRepos
}

/* remove cuplicate repos */
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

/* print repos list */
func printRepoList(repos []string) {
	for _, repo := range repos {
		util.Logger().Info("Repository discovered",
			zap.String("repository", repo),
		)
	}
}

/* print summary */
func printBackupSummaryFillAnalytics(repoNames []string, successCount int, skippedCount int, failedRepos []string, mon *monitor.Monitor) {
	err := collect.GenerateAnalytics(mon)
	if err != nil {
		util.Logger().Error(
			"Analytics generation failed",
			zap.Int("run_id", mon.RunID()),
			zap.Error(err),
		)
	}

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
