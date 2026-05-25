package util

import "go.uber.org/zap"

func InitLogger() (*zap.Logger, error) {
	logger, err := zap.NewProduction()
	if err != nil {
		return nil, err
	}

	zap.ReplaceGlobals(logger)
	return logger, nil
}

func Logger() *zap.Logger {
	return zap.L()
}