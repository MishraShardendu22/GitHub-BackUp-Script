package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestHandlerParamValidation(t *testing.T) {
	app := fiber.New()
	app.Get("/api/analytics/runs/:id", GetAnalyticsForSpecificRun)
	app.Get("/api/backup-fixes/runs/:id", GetBackupRunFixes)

	t.Run("GetAnalyticsForSpecificRun returns 400 for invalid run id", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/analytics/runs/not-a-number", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", resp.StatusCode)
		}
	})

	t.Run("GetBackupRunFixes returns 400 for invalid run id", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/backup-fixes/runs/invalid-id", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", resp.StatusCode)
		}
	})
}
