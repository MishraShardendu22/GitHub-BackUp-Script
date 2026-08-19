package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestErrorFormatting(t *testing.T) {
	app := fiber.New(fiber.Config{
		ErrorHandler: CustomErrorHandler,
	})

	app.Get("/bad-request", func(c *fiber.Ctx) error {
		return SendError(c, fiber.StatusBadRequest, "INVALID_PARAM", "Parameter is invalid", "repo_id must be int")
	})

	app.Get("/fiber-error", func(c *fiber.Ctx) error {
		return fiber.NewError(fiber.StatusNotFound, "Resource not found")
	})

	t.Run("SendError produces structured JSON envelope", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/bad-request", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", resp.StatusCode)
		}

		var body map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if body["success"] != false {
			t.Errorf("expected success=false, got %v", body["success"])
		}

		errMap, ok := body["error"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected error object, got %v", body["error"])
		}

		if errMap["code"] != "INVALID_PARAM" {
			t.Errorf("expected code INVALID_PARAM, got %v", errMap["code"])
		}
	})

	t.Run("CustomErrorHandler maps fiber.Error properly", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/fiber-error", nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", resp.StatusCode)
		}

		var body map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if body["success"] != false {
			t.Errorf("expected success=false, got %v", body["success"])
		}
	})
}
