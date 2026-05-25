package main

import (
	"github.com/MishraShardendu22/github-backup/config"
	"github.com/MishraShardendu22/github-backup/database"
	"github.com/MishraShardendu22/github-backup/service"
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

	logger.Info("Server started",
		zap.Int("port", 8080),
	)

	service.RunBackupFlow(cfg, db)
}
