package websocket

import (
	"context"
	"encoding/json"
	"github.com/MishraShardendu22/github-backup/backend/db"
	ws "github.com/gofiber/websocket/v2"
	"sync"
	"time"
)

/*
Hub - create a hub, to manage active web socket connections

  - clients are the users (basically browser)

  - mu is lock to prevent concurrent access to clients

    // not being used

  - broadcast is a buffered channel for message broadcast

Register - add a client
Unregister - remove a client
Broadcast - send message to all connected channels
*/
type Hub struct {
	clients map[*ws.Conn]bool
	mu      sync.RWMutex
	stopCh  chan struct{}
}

var DefaultHub = &Hub{
	clients: make(map[*ws.Conn]bool),
	stopCh:  make(chan struct{}),
}

// create a client and mark it as true
func (h *Hub) Register(c *ws.Conn) {
	h.mu.Lock()
	h.clients[c] = true
	h.mu.Unlock()
}

// delete a client
func (h *Hub) Unregister(c *ws.Conn) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
}

// write to the available clients
func (h *Hub) Broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		_ = client.SetWriteDeadline(time.Now().Add(3 * time.Second))
		_ = client.WriteMessage(ws.TextMessage, msg)
	}
}

// ClientCount returns the number of active websocket connections.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Stop terminates the polling loop gracefully.
func (h *Hub) Stop() {
	select {
	case <-h.stopCh:
		// already closed
	default:
		close(h.stopCh)
	}
}

// managing single web-socket connection
func HandleWebSocket(c *ws.Conn) {
	DefaultHub.Register(c)
	defer DefaultHub.Unregister(c)

	for {
		_, _, err := c.ReadMessage()
		if err != nil {
			break
		}
	}
}

// data source (database) is polling.
func (h *Hub) StartPolling() {
	go func() {
		var lastLogID int
		initialized := false
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-h.stopCh:
				return
			case <-ticker.C:
				if db.Pool == nil {
					continue
				}

				if !initialized {
					initCtx, initCancel := context.WithTimeout(context.Background(), 5*time.Second)
					_ = db.Pool.QueryRow(initCtx, "SELECT COALESCE(MAX(id), 0) FROM execution_logs").Scan(&lastLogID)
					initCancel()
					initialized = true
				}

				h.mu.RLock()
				clientCount := len(h.clients)
				h.mu.RUnlock()

				if clientCount == 0 {
					continue
				}

				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				rows, err := db.Pool.Query(ctx,
					`SELECT id, level, message, repository, created_at
					 FROM execution_logs WHERE id > $1 ORDER BY id LIMIT 50`, lastLogID)

				if err != nil {
					cancel()
					continue
				}

				for rows.Next() {
					var id int
					var createdAt time.Time
					var level, message, repo string
					if err := rows.Scan(&id, &level, &message, &repo, &createdAt); err != nil {
						continue
					}

					if id > lastLogID {
						lastLogID = id
					}

					logMsg, err := json.Marshal(map[string]interface{}{
						"type":       "log",
						"id":         id,
						"level":      level,
						"message":    message,
						"repository": repo,
						"timestamp":  createdAt,
					})

					if err != nil {
						continue
					}

					h.Broadcast(logMsg)
				}

				rows.Close()
				cancel()
			}
		}
	}()
}
