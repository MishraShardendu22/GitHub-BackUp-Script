package websocket

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	ws "github.com/gofiber/websocket/v2"
)

type Hub struct {
	clients   map[*ws.Conn]bool
	mu        sync.RWMutex
	broadcast chan []byte
}

var DefaultHub = &Hub{
	clients:   make(map[*ws.Conn]bool),
	broadcast: make(chan []byte, 256),
}

func (h *Hub) Register(c *ws.Conn) {
	h.mu.Lock()
	h.clients[c] = true
	h.mu.Unlock()
}

func (h *Hub) Unregister(c *ws.Conn) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
}

func (h *Hub) Broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		client.WriteMessage(ws.TextMessage, msg)
	}
}

func (h *Hub) Run() {
	for msg := range h.broadcast {
		h.Broadcast(msg)
	}
}

// StartPolling polls PostgreSQL for new logs and status, broadcasts to WebSocket clients
func (h *Hub) StartPolling() {
	// Poll for live status every 2 seconds
	go func() {
		var lastLogID int
		for {
			time.Sleep(2 * time.Second)

			h.mu.RLock()
			clientCount := len(h.clients)
			h.mu.RUnlock()

			if clientCount == 0 {
				continue
			}

			ctx := context.Background()

			// Send current run status
			var runID int
			var status string
			var totalRepos, successful, failed, skipped int
			var startedAt time.Time

			err := db.Pool.QueryRow(ctx,
				`SELECT id, status, total_repos, successful, failed, skipped, started_at
				 FROM backup_runs ORDER BY started_at DESC LIMIT 1`).Scan(
				&runID, &status, &totalRepos, &successful, &failed, &skipped, &startedAt)

			if err == nil {
				statusMsg, _ := json.Marshal(map[string]interface{}{
					"type":        "status",
					"run_id":      runID,
					"status":      status,
					"total_repos": totalRepos,
					"successful":  successful,
					"failed":      failed,
					"skipped":     skipped,
					"started_at":  startedAt,
				})
				h.Broadcast(statusMsg)
			}

			var totalSizeBytes int64
			var largestArchiveBytes int64
			var largestRepository string
			var repositoriesTracked int
			var runsTracked int

			err = db.Pool.QueryRow(ctx,
				`SELECT
					COALESCE(SUM(archive_size_bytes), 0),
					COALESCE(MAX(archive_size_bytes), 0),
					COALESCE((SELECT repo_full_name FROM backup_results ORDER BY archive_size_bytes DESC, created_at DESC LIMIT 1), ''),
					COALESCE(COUNT(DISTINCT repo_full_name), 0),
					COALESCE(COUNT(DISTINCT run_id), 0)
				 FROM backup_results`).Scan(
				&totalSizeBytes, &largestArchiveBytes, &largestRepository, &repositoriesTracked, &runsTracked)

			if err == nil {
				analyticsMsg, _ := json.Marshal(map[string]interface{}{
					"type":                  "analytics",
					"total_size_bytes":      totalSizeBytes,
					"largest_archive_bytes": largestArchiveBytes,
					"largest_repository":    largestRepository,
					"repositories_tracked":  repositoriesTracked,
					"runs_tracked":          runsTracked,
					"sampled_at":            time.Now().UTC(),
				})
				h.Broadcast(analyticsMsg)
			}

			// Send new logs since last check
			rows, err := db.Pool.Query(ctx,
				`SELECT id, level, message, repository, created_at
				 FROM execution_logs WHERE id > $1 ORDER BY id LIMIT 50`, lastLogID)
			if err != nil {
				continue
			}

			for rows.Next() {
				var id int
				var level, message, repo string
				var createdAt time.Time
				if err := rows.Scan(&id, &level, &message, &repo, &createdAt); err != nil {
					continue
				}
				if id > lastLogID {
					lastLogID = id
				}
				logMsg, _ := json.Marshal(map[string]interface{}{
					"type":       "log",
					"id":         id,
					"level":      level,
					"message":    message,
					"repository": repo,
					"timestamp":  createdAt,
				})
				h.Broadcast(logMsg)
			}
			rows.Close()
		}
	}()
}

func HandleWebSocket(c *ws.Conn) {
	DefaultHub.Register(c)
	defer DefaultHub.Unregister(c)

	// Keep connection alive, read pings
	for {
		_, _, err := c.ReadMessage()
		if err != nil {
			break
		}
	}
}
