package middleware

import (
	"errors"

	"github.com/gofiber/fiber/v2"
)

// APIError represents a standardized structured error object.
type APIError struct {
	Code      string      `json:"code"`
	Message   string      `json:"message"`
	Details   interface{} `json:"details,omitempty"`
	RequestID string      `json:"request_id,omitempty"`
}

// ErrorResponse is the standardized top-level error response envelope.
type ErrorResponse struct {
	Success bool     `json:"success"`
	Error   APIError `json:"error"`
	Message string   `json:"message"` // Top-level message for backward compatibility
}

// SendError sends a standardized JSON error response.
func SendError(c *fiber.Ctx, statusCode int, code, message string, details ...interface{}) error {
	reqID := GetRequestID(c)
	var detail interface{}
	if len(details) > 0 {
		detail = details[0]
	}

	return c.Status(statusCode).JSON(ErrorResponse{
		Success: false,
		Error: APIError{
			Code:      code,
			Message:   message,
			Details:   detail,
			RequestID: reqID,
		},
		Message: message,
	})
}

// CustomErrorHandler is the centralized Fiber error handler.
func CustomErrorHandler(c *fiber.Ctx, err error) error {
	statusCode := fiber.StatusInternalServerError
	code := "INTERNAL_ERROR"
	message := err.Error()

	var e *fiber.Error
	if errors.As(err, &e) {
		statusCode = e.Code
		message = e.Message
		switch statusCode {
		case fiber.StatusBadRequest:
			code = "BAD_REQUEST"
		case fiber.StatusUnauthorized:
			code = "UNAUTHORIZED"
		case fiber.StatusForbidden:
			code = "FORBIDDEN"
		case fiber.StatusNotFound:
			code = "NOT_FOUND"
		case fiber.StatusTooManyRequests:
			code = "RATE_LIMITED"
		case fiber.StatusServiceUnavailable:
			code = "SERVICE_UNAVAILABLE"
		}
	}

	return SendError(c, statusCode, code, message)
}
