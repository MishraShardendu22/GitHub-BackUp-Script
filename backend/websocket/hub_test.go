package websocket

import (
	"testing"
)

func TestHubLifecycle(t *testing.T) {
	hub := &Hub{
		clients: nil,
		stopCh:  make(chan struct{}),
	}

	if hub.ClientCount() != 0 {
		t.Fatalf("expected 0 clients, got %d", hub.ClientCount())
	}

	hub.Stop()

	// Verify Stop is idempotent and does not panic on multiple calls
	hub.Stop()
}
