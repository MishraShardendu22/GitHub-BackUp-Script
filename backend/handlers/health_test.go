package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestHealthEndpoints(t *testing.T) {
	app := fiber.New()
	app.Get("/health", LivenessCheck)
	app.Get("/ready", ReadinessCheck)
	app.Get("/metrics", GetSystemMetrics)

	t.Run("liveness check returns 200 and status ok", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", resp.StatusCode)
		}

		var body map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&body)
		if body["status"] != "ok" {
			t.Errorf("expected status 'ok', got %v", body["status"])
		}
	})

	t.Run("metrics returns prometheus text format by default", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", resp.StatusCode)
		}
	})

	t.Run("metrics returns json when format=json is queried", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/metrics?format=json", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", resp.StatusCode)
		}

		var body map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&body)
		if _, ok := body["uptime_seconds"]; !ok {
			t.Errorf("expected uptime_seconds in json response")
		}
	})
}
