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
	"sync"
	"time"
)

// EmbeddingClient handles communication with the OpenRouter embedding API
// and supports automatic multi-key failover and rotation.
type EmbeddingClient struct {
	apiKeys      []string
	activeKeyIdx int
	mu           sync.Mutex
	baseURL      string
	httpClient   *http.Client
	maxRetries   int
}

// NewEmbeddingClient creates a new client. apiKey can be a single key or comma-separated list of keys.
func NewEmbeddingClient(apiKey string) *EmbeddingClient {
	var keys []string
	for _, k := range strings.Split(apiKey, ",") {
		trimmed := strings.TrimSpace(k)
		if trimmed != "" {
			keys = append(keys, trimmed)
		}
	}

	return &EmbeddingClient{
		apiKeys: keys,
		baseURL: "https://openrouter.ai/api/v1",
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		maxRetries: 3,
	}
}

// getKey returns the currently active key.
func (c *EmbeddingClient) getKey() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.apiKeys) == 0 {
		return ""
	}
	return c.apiKeys[c.activeKeyIdx%len(c.apiKeys)]
}

// rotateKey advances to the next available API key.
func (c *EmbeddingClient) rotateKey(reason string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.apiKeys) <= 1 {
		if len(c.apiKeys) == 1 {
			return c.apiKeys[0]
		}
		return ""
	}
	c.activeKeyIdx = (c.activeKeyIdx + 1) % len(c.apiKeys)
	newKey := c.apiKeys[c.activeKeyIdx]
	log.Printf("[OpenRouter] Key failover triggered (%s): switching to key %d/%d", reason, c.activeKeyIdx+1, len(c.apiKeys))
	return newKey
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
// Implements retry with exponential backoff and automatic multi-key failover.
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
	totalKeys := len(c.apiKeys)
	if totalKeys == 0 {
		return nil, fmt.Errorf("no OpenRouter API keys configured")
	}

	for keyAttempt := 0; keyAttempt < totalKeys; keyAttempt++ {
		currentKey := c.getKey()

		for attempt := 0; attempt <= c.maxRetries; attempt++ {
			req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
			if err != nil {
				return nil, fmt.Errorf("failed to create request: %w", err)
			}

			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", currentKey))

			log.Printf("Attempt %d: sending embedding request to %s (model: %s, %d texts)", attempt+1, url, model, len(texts))
			resp, err := c.httpClient.Do(req)

			if err != nil {
				if attempt == c.maxRetries {
					if totalKeys > 1 && keyAttempt < totalKeys-1 {
						c.rotateKey(fmt.Sprintf("network error: %v", err))
						break
					}
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

			// Key-level failures (401 invalid key, 402 no credits, 403 forbidden, 429 rate limit)
			if (resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusPaymentRequired || resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests) && totalKeys > 1 && keyAttempt < totalKeys-1 {
				resp.Body.Close()
				c.rotateKey(fmt.Sprintf("HTTP %d", resp.StatusCode))
				break // break inner retry loop to try with the next key
			}

			if resp.StatusCode == http.StatusTooManyRequests {
				resp.Body.Close()
				if attempt == c.maxRetries {
					return nil, fmt.Errorf("rate limited and exhausted %d retries", c.maxRetries+1)
				}

				retryAfterStr := resp.Header.Get("Retry-After")
				retryAfterSec := 1
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
					if totalKeys > 1 && keyAttempt < totalKeys-1 {
						c.rotateKey(fmt.Sprintf("HTTP %d", resp.StatusCode))
						break
					}
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
	}

	return nil, fmt.Errorf("exhausted all OpenRouter keys and retries")
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
