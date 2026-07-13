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
}

var DefaultHub = &Hub{
	clients: make(map[*ws.Conn]bool),
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
		client.WriteMessage(ws.TextMessage, msg)
	}
}

// managing single web-socket connection
func HandleWebSocket(c *ws.Conn) {
	// register a user in hte default hub

	// add this connection to clients so it can ercieve broadcast messages
	DefaultHub.Register(c)

	// close the connection when it ends and client exits
	defer DefaultHub.Unregister(c)

	// read
	for {
		_, _, err := c.ReadMessage()

		// messageType, payload, err := c.ReadMessage()
		// we are ignoring message type and payload (data they send) cause we dont need it
		// we only care about connection existing
		// messageType
		// - ws.TextMessage
		// - ws.BinaryMessage
		// - ws.CloseMessage
		// - ws.PingMessage
		// - ws.PongMessage

		if err != nil {
			break
		}
	}
}

// data source (database) is polling.
func (h *Hub) StartPolling() {
	go func() {
		var lastLogID int
		// Infinite Loop
		for {
			// Polling database after every 2 secs
			time.Sleep(2 * time.Second)

			// reads how many clients are there
			// if there is no read lock it may cause - fatal error: concurrent map iteration and map write
			h.mu.RLock()
			clientCount := len(h.clients)
			h.mu.RUnlock()

			// if no clients
			if clientCount == 0 {
				continue
			}

			ctx := context.Background()
			// fetch 50 new logs since lastLogID
			rows, err := db.Pool.Query(ctx,
				`SELECT id, level, message, repository, created_at
				 FROM execution_logs WHERE id > $1 ORDER BY id LIMIT 50`, lastLogID)

			if err != nil {
				continue
			}

			// processes every row returned by the SQL query and sends it to all (broadcast) connected WebSocket clients.
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
		}
	}()
}
