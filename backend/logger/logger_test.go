package logger

import (
	"log/slog"
	"testing"
)

func TestLoggerInit(t *testing.T) {
	tests := []struct {
		level string
	}{
		{"debug"},
		{"info"},
		{"warn"},
		{"error"},
		{"unknown_defaults_to_info"},
	}

	for _, tt := range tests {
		t.Run("level_"+tt.level, func(t *testing.T) {
			InitLogger(tt.level)
			if Log == nil {
				t.Fatalf("expected Log to be initialized")
			}
			Log.Info("test message", slog.String("test_key", "test_val"))
		})
	}
}
