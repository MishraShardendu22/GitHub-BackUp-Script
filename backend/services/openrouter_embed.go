package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// EmbeddingClient handles communication with the OpenRouter embedding API.
type EmbeddingClient struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	maxRetries int
}

// NewEmbeddingClient creates a new client. apiKey is the OpenRouter API key.
// Uses standard library net/http only (no external packages).
func NewEmbeddingClient(apiKey string) *EmbeddingClient {
	return &EmbeddingClient{
		apiKey:  apiKey,
		baseURL: "https://openrouter.ai/api/v1",
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		maxRetries: 3,
	}
}

// EmbeddingRequest represents a request to the embedding API.
type EmbeddingRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

// EmbeddingResponse represents the API response.
type EmbeddingResponse struct {
	Data  []EmbeddingData `json:"data"`
	Model string          `json:"model"`
	Usage EmbeddingUsage  `json:"usage"`
}

type EmbeddingData struct {
	Embedding []float32 `json:"embedding"`
	Index     int       `json:"index"`
}

type EmbeddingUsage struct {
	PromptTokens int `json:"prompt_tokens"`
	TotalTokens  int `json:"total_tokens"`
}

// Embed sends texts to the OpenRouter embedding API and returns vectors.
// Implements retry with exponential backoff (up to maxRetries).
// Handles: timeouts (30s per request), rate limits (429 with Retry-After), server errors (5xx).
// Returns error for 4xx (except 429), malformed responses, or exhausted retries.
func (c *EmbeddingClient) Embed(ctx context.Context, model string, texts []string) (*EmbeddingResponse, error) {
	reqBody := EmbeddingRequest{
		Model: model,
		Input: texts,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	url := fmt.Sprintf("%s/embeddings", strings.TrimRight(c.baseURL, "/"))

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))

		log.Printf("Attempt %d: sending embedding request to %s (model: %s, %d texts)", attempt+1, url, model, len(texts))
		resp, err := c.httpClient.Do(req)

		if err != nil {
			if attempt == c.maxRetries {
				return nil, fmt.Errorf("request failed after %d attempts: %w", c.maxRetries+1, err)
			}
			backoff := time.Duration(math.Min(30, math.Pow(2, float64(attempt)))) * time.Second
			log.Printf("Attempt %d failed with error %v, retrying in %v...", attempt+1, err, backoff)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
			continue
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			if attempt == c.maxRetries {
				return nil, fmt.Errorf("rate limited and exhausted %d retries", c.maxRetries+1)
			}
			
			retryAfterStr := resp.Header.Get("Retry-After")
			retryAfterSec := 1 // default
			if retryAfterStr != "" {
				if parsed, err := strconv.Atoi(retryAfterStr); err == nil && parsed > 0 {
					retryAfterSec = parsed
				}
			}
			
			backoff := time.Duration(retryAfterSec) * time.Second
			log.Printf("Rate limited (429), retrying after %v...", backoff)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
			continue
		}

		if resp.StatusCode >= 500 {
			resp.Body.Close()
			if attempt == c.maxRetries {
				return nil, fmt.Errorf("server error %d after %d attempts", resp.StatusCode, c.maxRetries+1)
			}
			backoff := time.Duration(math.Min(30, math.Pow(2, float64(attempt)))) * time.Second
			log.Printf("Server error %d, retrying in %v...", resp.StatusCode, backoff)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
			continue
		}

		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("failed to read response body: %w", err)
		}

		var embedResp EmbeddingResponse
		if err := json.Unmarshal(body, &embedResp); err != nil {
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}

		if len(embedResp.Data) != len(texts) {
			return nil, fmt.Errorf("response data length (%d) does not match input length (%d)", len(embedResp.Data), len(texts))
		}

		for i, d := range embedResp.Data {
			if len(d.Embedding) == 0 {
				return nil, fmt.Errorf("empty embedding returned at index %d", i)
			}
		}

		return &embedResp, nil
	}

	return nil, fmt.Errorf("exhausted max retries")
}

// EmbedSingle embeds a single text. Convenience wrapper.
func (c *EmbeddingClient) EmbedSingle(ctx context.Context, model, text string) ([]float32, error) {
	resp, err := c.Embed(ctx, model, []string{text})
	if err != nil {
		return nil, err
	}
	if len(resp.Data) == 0 {
		return nil, fmt.Errorf("no embedding data returned")
	}
	return resp.Data[0].Embedding, nil
}
