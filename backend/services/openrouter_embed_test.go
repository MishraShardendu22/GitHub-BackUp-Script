package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestEmbeddingClient(t *testing.T) {
	t.Run("successful embedding response", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != "Bearer test-api-key" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			resp := EmbeddingResponse{
				Model: "test-model",
				Data: []EmbeddingData{
					{Index: 0, Embedding: []float32{0.1, 0.2, 0.3}},
				},
				Usage: EmbeddingUsage{PromptTokens: 5, TotalTokens: 5},
			}
			_ = json.NewEncoder(w).Encode(resp)
		}))
		defer ts.Close()

		client := NewEmbeddingClient("test-api-key")
		client.baseURL = ts.URL

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		vec, err := client.EmbedSingle(ctx, "test-model", "hello world")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(vec) != 3 || vec[0] != 0.1 {
			t.Errorf("unexpected vector: %v", vec)
		}
	})

	t.Run("fails when all keys are invalid", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte("invalid api key"))
		}))
		defer ts.Close()

		client := NewEmbeddingClient("invalid-key-1,invalid-key-2")
		client.baseURL = ts.URL

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		_, err := client.EmbedSingle(ctx, "test-model", "test")
		if err == nil {
			t.Fatalf("expected error on 401, got nil")
		}
	})

	t.Run("successfully fails over to second key on 401", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth == "Bearer bad-key" {
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte("key revoked"))
				return
			}
			if auth == "Bearer good-key" {
				resp := EmbeddingResponse{
					Model: "test-model",
					Data: []EmbeddingData{
						{Index: 0, Embedding: []float32{0.5, 0.6, 0.7}},
					},
					Usage: EmbeddingUsage{PromptTokens: 5, TotalTokens: 5},
				}
				_ = json.NewEncoder(w).Encode(resp)
				return
			}
			w.WriteHeader(http.StatusBadRequest)
		}))
		defer ts.Close()

		client := NewEmbeddingClient("bad-key,good-key")
		client.baseURL = ts.URL

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		vec, err := client.EmbedSingle(ctx, "test-model", "failover test")
		if err != nil {
			t.Fatalf("expected failover to succeed with good-key, got error: %v", err)
		}

		if len(vec) != 3 || vec[0] != 0.5 {
			t.Errorf("unexpected vector from good-key: %v", vec)
		}
	})
}
