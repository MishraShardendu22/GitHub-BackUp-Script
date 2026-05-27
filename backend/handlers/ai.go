package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/gofiber/fiber/v2"
)

type ChatRequest struct {
	ConversationID int    `json:"conversation_id"`
	Message        string `json:"message"`
	WebSearch      bool   `json:"web_search"`
}

func PostChat(c *fiber.Ctx) error {
	var req ChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}

	// Create conversation if needed
	convID := req.ConversationID
	if convID == 0 {
		title := req.Message
		if len(title) > 60 {
			title = title[:60] + "..."
		}
		err := db.Pool.QueryRow(context.Background(),
			`INSERT INTO ai_conversations (title) VALUES ($1) RETURNING id`, title).Scan(&convID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to create conversation"})
		}
	}

	// Save user message
	db.Pool.Exec(context.Background(),
		`INSERT INTO ai_messages (conversation_id, role, content, web_search) VALUES ($1, 'user', $2, $3)`,
		convID, req.Message, req.WebSearch)

	// Build context from DB
	dbContext := buildDBContext()

	// Call OpenRouter
	model := os.Getenv("MODEL_NAME")
	if model == "" {
		model = "google/gemini-2.5-flash"
	}
	if req.WebSearch {
		model += ":online"
	}

	apiKey := os.Getenv("MODEL_KEY")
	if apiKey == "" {
		return c.Status(500).JSON(fiber.Map{"error": "MODEL_KEY not configured"})
	}

	systemPrompt := fmt.Sprintf(`You are an AI assistant for a GitHub backup monitoring system. 
You help users understand their backup status, analyze failures, and provide insights.

Here is the current system context:
%s

Answer questions based on this data. Be concise and helpful.`, dbContext)

	messages := []map[string]string{
		{"role": "system", "content": systemPrompt},
		{"role": "user", "content": req.Message},
	}

	// Load conversation history (last 10 messages)
	historyRows, _ := db.Pool.Query(context.Background(),
		`SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10`, convID)
	if historyRows != nil {
		var history []map[string]string
		for historyRows.Next() {
			var role, content string
			historyRows.Scan(&role, &content)
			history = append([]map[string]string{{"role": role, "content": content}}, history...)
		}
		historyRows.Close()
		if len(history) > 1 {
			messages = append(messages[:1], history...)
		}
	}

	body := map[string]interface{}{
		"model":    model,
		"messages": messages,
	}

	bodyJSON, _ := json.Marshal(body)

	httpReq, _ := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", strings.NewReader(string(bodyJSON)))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("HTTP-Referer", os.Getenv("OPENROUTER_SITE_URL"))
	httpReq.Header.Set("X-Title", "GitHub Backup Monitor")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "AI request failed: " + err.Error()})
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			TotalTokens int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil || len(result.Choices) == 0 {
		return c.Status(500).JSON(fiber.Map{"error": "failed to parse AI response", "raw": string(respBody)})
	}

	aiContent := result.Choices[0].Message.Content
	tokens := result.Usage.TotalTokens

	// Save assistant message
	db.Pool.Exec(context.Background(),
		`INSERT INTO ai_messages (conversation_id, role, content, tokens_used, web_search) VALUES ($1, 'assistant', $2, $3, $4)`,
		convID, aiContent, tokens, req.WebSearch)

	return c.JSON(fiber.Map{
		"conversation_id": convID,
		"message":         aiContent,
		"tokens_used":     tokens,
		"web_search":      req.WebSearch,
		"model":           model,
	})
}

func GetConversations(c *fiber.Ctx) error {
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, title, created_at FROM ai_conversations ORDER BY created_at DESC LIMIT 50`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var convs []models.Conversation
	for rows.Next() {
		var conv models.Conversation
		if err := rows.Scan(&conv.ID, &conv.Title, &conv.CreatedAt); err != nil {
			continue
		}
		convs = append(convs, conv)
	}

	if convs == nil {
		convs = []models.Conversation{}
	}
	return c.JSON(convs)
}

func GetConversation(c *fiber.Ctx) error {
	id := c.Params("id")

	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, conversation_id, role, content, tokens_used, web_search, created_at
		 FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var messages []models.ChatMessage
	for rows.Next() {
		var m models.ChatMessage
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Role, &m.Content, &m.TokensUsed, &m.WebSearch, &m.CreatedAt); err != nil {
			continue
		}
		messages = append(messages, m)
	}

	if messages == nil {
		messages = []models.ChatMessage{}
	}
	return c.JSON(messages)
}

func DeleteConversation(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := db.Pool.Exec(context.Background(), `DELETE FROM ai_conversations WHERE id = $1`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"deleted": true})
}

func buildDBContext() string {
	ctx := context.Background()
	var sb strings.Builder

	// Recent backup stats
	var totalRuns, totalSuccess, totalFailed int
	db.Pool.QueryRow(ctx, `SELECT COUNT(*), COALESCE(SUM(successful),0), COALESCE(SUM(failed),0) FROM backup_runs`).Scan(&totalRuns, &totalSuccess, &totalFailed)
	sb.WriteString(fmt.Sprintf("Total backup runs: %d, Total successful repos: %d, Total failed: %d\n", totalRuns, totalSuccess, totalFailed))

	// Last 5 runs
	rows, _ := db.Pool.Query(ctx, `SELECT status, started_at, total_repos, successful, failed, duration_ms FROM backup_runs ORDER BY started_at DESC LIMIT 5`)
	if rows != nil {
		sb.WriteString("\nRecent runs:\n")
		for rows.Next() {
			var status string
			var startedAt time.Time
			var total, success, fail int
			var dur int64
			rows.Scan(&status, &startedAt, &total, &success, &fail, &dur)
			sb.WriteString(fmt.Sprintf("- %s at %s: %d repos (%d ok, %d fail, %dms)\n",
				status, startedAt.Format("2006-01-02 15:04"), total, success, fail, dur))
		}
		rows.Close()
	}

	// Recent failures
	failRows, _ := db.Pool.Query(ctx, `SELECT repo_full_name, error_message, created_at FROM backup_results WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10`)
	if failRows != nil {
		sb.WriteString("\nRecent failures:\n")
		count := 0
		for failRows.Next() {
			var repo, errMsg string
			var t time.Time
			failRows.Scan(&repo, &errMsg, &t)
			sb.WriteString(fmt.Sprintf("- %s: %s (%s)\n", repo, errMsg, t.Format("2006-01-02")))
			count++
		}
		failRows.Close()
		if count == 0 {
			sb.WriteString("- No recent failures\n")
		}
	}

	return sb.String()
}
