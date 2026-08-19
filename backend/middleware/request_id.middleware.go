package middleware

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/gofiber/fiber/v2"
)

const HeaderXRequestID = "X-Request-ID"
const LocalKeyRequestID = "request_id"

// generateRandomID creates a 16-byte random hex string.
func generateRandomID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return "req-fallback-id"
	}
	return hex.EncodeToString(b)
}

// RequestIDMiddleware extracts or assigns a unique request ID to every incoming request.
func RequestIDMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		reqID := c.Get(HeaderXRequestID)
		if reqID == "" {
			reqID = generateRandomID()
		}

		c.Locals(LocalKeyRequestID, reqID)
		c.Set(HeaderXRequestID, reqID)

		return c.Next()
	}
}

// GetRequestID retrieves the request ID from fiber context.
func GetRequestID(c *fiber.Ctx) string {
	if val, ok := c.Locals(LocalKeyRequestID).(string); ok && val != "" {
		return val
	}
	return c.Get(HeaderXRequestID)
}
