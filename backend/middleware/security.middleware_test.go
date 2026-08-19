package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestInternalAuthMiddleware(t *testing.T) {
	app := fiber.New()
	app.Get("/test-internal", InternalAuthMiddleware(), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	t.Run("fails when INTERNAL_SECRET is not configured", func(t *testing.T) {
		os.Unsetenv("INTERNAL_SECRET")
		req := httptest.NewRequest(http.MethodGet, "/test-internal", nil)
		req.Header.Set("X-Internal-Secret", "some-secret")

		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", resp.StatusCode)
		}
	})

	t.Run("fails when X-Internal-Secret header is missing", func(t *testing.T) {
		os.Setenv("INTERNAL_SECRET", "super-secret-key-123")
		defer os.Unsetenv("INTERNAL_SECRET")

		req := httptest.NewRequest(http.MethodGet, "/test-internal", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", resp.StatusCode)
		}
	})

	t.Run("fails when X-Internal-Secret header is invalid", func(t *testing.T) {
		os.Setenv("INTERNAL_SECRET", "super-secret-key-123")
		defer os.Unsetenv("INTERNAL_SECRET")

		req := httptest.NewRequest(http.MethodGet, "/test-internal", nil)
		req.Header.Set("X-Internal-Secret", "wrong-secret-key")

		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", resp.StatusCode)
		}
	})

	t.Run("succeeds when X-Internal-Secret matches INTERNAL_SECRET", func(t *testing.T) {
		os.Setenv("INTERNAL_SECRET", "super-secret-key-123")
		defer os.Unsetenv("INTERNAL_SECRET")

		req := httptest.NewRequest(http.MethodGet, "/test-internal", nil)
		req.Header.Set("X-Internal-Secret", "super-secret-key-123")

		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", resp.StatusCode)
		}
	})
}
