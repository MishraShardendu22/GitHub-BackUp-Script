package main

import (
	"github.com/MishraShardendu22/github-backup/backup-worker/config"
	"github.com/MishraShardendu22/github-backup/backup-worker/database"
	"github.com/MishraShardendu22/github-backup/backup-worker/service"
	"github.com/MishraShardendu22/github-backup/backup-worker/service/helper"
	"github.com/MishraShardendu22/github-backup/backup-worker/service/monitor"
	"github.com/MishraShardendu22/github-backup/backup-worker/util"
	"go.uber.org/zap"
)

func main() {
	logger, err := util.InitLogger()
	util.ErrorHandler(err)

	defer logger.Sync()

	config.LoadEnv()
	cfg := config.LoadConfig()

	// always pull latest repository and database changes before connecting to SQLite
	_ = helper.PullRootRepo()

	db, err := database.ConnectSQLite(cfg)
	util.ErrorHandler(err)
	defer db.Close()

	if err := monitor.Init(); err != nil {
		logger.Warn("PostgreSQL monitor disabled", zap.Error(err))
	}
	defer monitor.Close()

	logger.Info("Worker started")

	service.RunBackupFlow(cfg, db)
}
