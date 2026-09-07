package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/MishraShardendu22/github-backup/backend/config"
	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/logger"
	"github.com/MishraShardendu22/github-backup/backend/middleware"
	"github.com/MishraShardendu22/github-backup/backend/routes"
	"github.com/MishraShardendu22/github-backup/backend/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
)

func main() {
	for _, envFile := range []string{".env", "backend/.env"} {
		if _, err := os.Stat(envFile); err == nil {
			_ = godotenv.Load(envFile)
			break
		}
	}

	cfg, err := config.LoadAndValidate()
	if err != nil {
		logger.InitLogger("info")
		logger.Log.Error("Configuration validation failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger.InitLogger(cfg.LogLevel)
	logger.Log.Info("Configuration validated successfully",
		slog.String("port", cfg.ServerPort),
		slog.Int("db_max_conns", int(cfg.DBMaxConns)),
		slog.Int("db_min_conns", int(cfg.DBMinConns)),
	)

	if err := db.Connect(); err != nil {
		logger.Log.Error("Failed to connect to PostgreSQL", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer db.Close()

	if err := db.RunMigrations(); err != nil {
		logger.Log.Error("Failed to run database migrations", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger.Log.Info("PostgreSQL connected and schema migrations applied")

	app := fiber.New(fiber.Config{
		AppName:      "GitHub Backup Monitor",
		BodyLimit:    config.MaxBodyLimitBytes,
		ServerHeader: "GBM",
		ErrorHandler: middleware.CustomErrorHandler,
	})

	app.Use(middleware.RequestIDMiddleware())
	app.Use(middleware.SetupCORS())
	app.Use(middleware.StructuredLoggerMiddleware())

	app.Options("/*", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	routes.Setup(app)

	websocket.DefaultHub.StartPolling()

	go func() {
		if err := app.Listen(":" + cfg.ServerPort); err != nil && err != http.ErrServerClosed {
			logger.Log.Error("Server error", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	fmt.Printf("Backend server running on http://localhost:%s\n", cfg.ServerPort)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Log.Info("Shutting down server gracefully...")
	websocket.DefaultHub.Stop()
	_ = app.Shutdown()
	db.Close()
	logger.Log.Info("Server stopped")
}
