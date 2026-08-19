package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestRequestIDAndCORSMiddleware(t *testing.T) {
	app := fiber.New()
	app.Use(RequestIDMiddleware())
	app.Use(SetupCORS())
	app.Use(StructuredLoggerMiddleware())

	app.Get("/test-mw", func(c *fiber.Ctx) error {
		reqID := c.Locals("request_id")
		if reqID == nil || reqID == "" {
			return c.Status(fiber.StatusInternalServerError).SendString("missing request_id")
		}
		return c.SendString("ok")
	})

	t.Run("generates request id if header missing", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test-mw", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}
		if resp.Header.Get("X-Request-ID") == "" {
			t.Errorf("expected X-Request-ID header in response")
		}
	})

	t.Run("propagates existing request id header", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test-mw", nil)
		req.Header.Set("X-Request-ID", "custom-req-id-12345")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}
		if resp.Header.Get("X-Request-ID") != "custom-req-id-12345" {
			t.Errorf("expected custom-req-id-12345, got %s", resp.Header.Get("X-Request-ID"))
		}
	})
}
