package util

import (
	"os"

	"go.uber.org/zap"
)

func ErrorHandler(err error) {
	if err == nil {
		return
	}

	logger := Logger()
	logger.Error("fatal error", zap.Error(err))
	_ = logger.Sync()
	os.Exit(1)
}
