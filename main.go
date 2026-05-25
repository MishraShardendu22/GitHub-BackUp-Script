package main

import (
	"github.com/MishraShardendu22/github-backup/config"
	"github.com/MishraShardendu22/github-backup/service"
	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

func main() {
	logger, err := util.InitLogger()
	util.ErrorHandler(err)

	defer logger.Sync()

	config.LoadEnv()

	logger.Info("Server started",
		zap.Int("port", 8080),
	)

	service.RunBackupFlow()
}
