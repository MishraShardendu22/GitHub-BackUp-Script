package middleware

import (
	"crypto/subtle"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/config"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func SetupCORS() fiber.Handler {
	return cors.New(cors.Config{
		AllowOrigins:     "https://github.mishrashardendu22.is-a.dev,http://localhost:3000",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Authorization, X-Internal-Secret",
		AllowCredentials: true,
	})
}

func SetupLogger() fiber.Handler {
	return logger.New(logger.Config{
		Format:     "${time} | ${status} | ${latency} | ${method} ${path}\n",
		TimeFormat: "2006-01-02 15:04:05",
	})
}

func RateLimitDefault() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        100,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return SendError(c, fiber.StatusTooManyRequests, "RATE_LIMITED", "rate limit exceeded. try again later.")
		},
	})
}

// InternalAuthMiddleware verifies the X-Internal-Secret header against the internal secret in config.
// Uses constant-time comparison to prevent timing attacks.
func InternalAuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		expectedSecret := config.GetInternalSecret()
		if expectedSecret == "" {
			return SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "INTERNAL_SECRET is not configured on server")
		}

		providedSecret := c.Get("X-Internal-Secret")
		if providedSecret == "" {
			return SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "missing X-Internal-Secret header")
		}

		if subtle.ConstantTimeCompare([]byte(providedSecret), []byte(expectedSecret)) != 1 {
			return SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "invalid internal secret")
		}

		return c.Next()
	}
}
