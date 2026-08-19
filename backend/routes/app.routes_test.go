package routes

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/MishraShardendu22/github-backup/backend/middleware"
	"github.com/gofiber/fiber/v2"
)

func TestAppRouteProtection(t *testing.T) {
	app := fiber.New()
	api := app.Group("/api")

	// Public route simulation
	api.Get("/public-test", func(c *fiber.Ctx) error {
		return c.SendString("public ok")
	})

	// Internal protected route simulation
	internal := api.Group("/internal", middleware.InternalAuthMiddleware())
	internal.Get("/protected-test", func(c *fiber.Ctx) error {
		return c.SendString("protected ok")
	})

	os.Setenv("INTERNAL_SECRET", "super-secret-xyz")
	defer os.Unsetenv("INTERNAL_SECRET")

	t.Run("public endpoint succeeds without X-Internal-Secret", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/public-test", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", resp.StatusCode)
		}
	})

	t.Run("internal endpoint returns 401 without X-Internal-Secret", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/internal/protected-test", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", resp.StatusCode)
		}
	})

	t.Run("internal endpoint returns 401 with invalid X-Internal-Secret", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/internal/protected-test", nil)
		req.Header.Set("X-Internal-Secret", "wrong-secret")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", resp.StatusCode)
		}
	})

	t.Run("internal endpoint succeeds with valid X-Internal-Secret", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/internal/protected-test", nil)
		req.Header.Set("X-Internal-Secret", "super-secret-xyz")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", resp.StatusCode)
		}
	})
}
