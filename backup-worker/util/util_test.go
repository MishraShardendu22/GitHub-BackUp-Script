package util

import (
	"os"
	"testing"
)

func TestGetEnv(t *testing.T) {
	os.Setenv("TEST_VAR_EXISTS", "custom_val")
	defer os.Unsetenv("TEST_VAR_EXISTS")

	if val := GetEnv("TEST_VAR_EXISTS", "default_val"); val != "custom_val" {
		t.Errorf("expected custom_val, got %s", val)
	}

	if val := GetEnv("TEST_VAR_NONEXISTENT", "default_val"); val != "default_val" {
		t.Errorf("expected default_val, got %s", val)
	}
}

func TestLogger(t *testing.T) {
	log := Logger()
	if log == nil {
		t.Fatalf("expected logger to not be nil")
	}
}
