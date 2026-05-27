package main

import (
	"github.com/MishraShardendu22/github-backup/config"
	"github.com/MishraShardendu22/github-backup/database"
	"github.com/MishraShardendu22/github-backup/service"
	"github.com/MishraShardendu22/github-backup/service/monitor"
	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

func main() {
	logger, err := util.InitLogger()
	util.ErrorHandler(err)

	defer logger.Sync()

	config.LoadEnv()
	cfg := config.LoadConfig()

	db, err := database.ConnectSQLite(cfg)
	util.ErrorHandler(err)
	defer db.Close()

	// Initialize PostgreSQL monitor (for dashboard)
	if err := monitor.Init(); err != nil {
		logger.Warn("PostgreSQL monitor disabled", zap.Error(err))
	}
	defer monitor.Close()

	logger.Info("Worker started")

	service.RunBackupFlow(cfg, db)
}
