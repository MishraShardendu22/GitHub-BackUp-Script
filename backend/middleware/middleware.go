package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func SetupCORS() fiber.Handler {
	return cors.New(cors.Config{
		AllowOrigins:     "https://mishra.is-a.dev",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Authorization",
		AllowCredentials: true,
	})
}

func SetupLogger() fiber.Handler {
	return logger.New(logger.Config{
		Format:     "${time} | ${status} | ${latency} | ${method} ${path}\n",
		TimeFormat: "2006-01-02 15:04:05",
	})
}
