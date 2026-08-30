package db

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/jackc/pgx/v5/pgxpool"
	pgvector "github.com/pgvector/pgvector-go"
)

// testSetup connects to the test database, runs migrations, and cleans up
// embedding tables for test isolation. Tests require POSTGRES_URL to be set.
func testSetup(t *testing.T) context.Context {
	t.Helper()

	url := os.Getenv("POSTGRES_URL")
	if url == "" {
		t.Skip("POSTGRES_URL not set — skipping integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	t.Cleanup(cancel)

	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatalf("parse postgres url: %v", err)
	}
	config.MaxConns = 5
	config.MinConns = 1

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatalf("connect to postgres: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("ping postgres: %v", err)
	}

	// Set the global pool for the db package
	Pool = pool

	// Run migrations
	if err := RunMigrations(); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	// Clean up embedding tables for test isolation (order matters for FK)
	_, _ = Pool.Exec(ctx, "DELETE FROM embedding_chunks")
	_, _ = Pool.Exec(ctx, "DELETE FROM embedding_generations")

	return ctx
}

// contentHash returns a SHA-256 hex digest of the given content.
func contentHash(content string) string {
	h := sha256.Sum256([]byte(content))
	return fmt.Sprintf("%x", h)
}

// TestGenerationLifecycle verifies a generation can transition through
// BUILDING -> READY -> ACTIVE -> RETIRED.
func TestGenerationLifecycle(t *testing.T) {
	ctx := testSetup(t)

	// Create a new generation (starts as BUILDING)
	genID, err := CreateGeneration(ctx, "text-embedding-3-small", 1536)
	if err != nil {
		t.Fatalf("CreateGeneration: %v", err)
	}
	if genID == 0 {
		t.Fatal("expected non-zero generation ID")
	}

	// Verify BUILDING status
	gen, err := GetGenerationByID(ctx, genID)
	if err != nil {
		t.Fatalf("GetGenerationByID: %v", err)
	}
	if gen.Status != models.GenerationStatusBuilding {
		t.Errorf("expected BUILDING, got %s", gen.Status)
	}
	if gen.ModelID != "text-embedding-3-small" {
		t.Errorf("expected model_id text-embedding-3-small, got %s", gen.ModelID)
	}
	if gen.Dimensions != 1536 {
		t.Errorf("expected dimensions 1536, got %d", gen.Dimensions)
	}

	// Transition to READY
	if err := UpdateGenerationStatus(ctx, genID, models.GenerationStatusReady); err != nil {
		t.Fatalf("UpdateGenerationStatus(READY): %v", err)
	}
	gen, _ = GetGenerationByID(ctx, genID)
	if gen.Status != models.GenerationStatusReady {
		t.Errorf("expected READY, got %s", gen.Status)
	}
	if gen.CompletedAt == nil {
		t.Error("expected completed_at to be set for READY status")
	}

	// Transition to ACTIVE
	if err := UpdateGenerationStatus(ctx, genID, models.GenerationStatusActive); err != nil {
		t.Fatalf("UpdateGenerationStatus(ACTIVE): %v", err)
	}
	gen, _ = GetGenerationByID(ctx, genID)
	if gen.Status != models.GenerationStatusActive {
		t.Errorf("expected ACTIVE, got %s", gen.Status)
	}
	if gen.ActivatedAt == nil {
		t.Error("expected activated_at to be set for ACTIVE status")
	}

	// Transition to RETIRED
	if err := UpdateGenerationStatus(ctx, genID, models.GenerationStatusRetired); err != nil {
		t.Fatalf("UpdateGenerationStatus(RETIRED): %v", err)
	}
	gen, _ = GetGenerationByID(ctx, genID)
	if gen.Status != models.GenerationStatusRetired {
		t.Errorf("expected RETIRED, got %s", gen.Status)
	}
	if gen.RetiredAt == nil {
		t.Error("expected retired_at to be set for RETIRED status")
	}
}

// TestGenerationSingleActive verifies that only one generation can be ACTIVE
// at a time (enforced by partial unique index).
func TestGenerationSingleActive(t *testing.T) {
	ctx := testSetup(t)

	// Create and activate first generation
	gen1ID, _ := CreateGeneration(ctx, "model-a", 1536)
	_ = UpdateGenerationStatus(ctx, gen1ID, models.GenerationStatusReady)
	_ = UpdateGenerationStatus(ctx, gen1ID, models.GenerationStatusActive)

	// Verify it's active
	active, _ := GetActiveGeneration(ctx)
	if active == nil || active.ID != gen1ID {
		t.Fatal("expected gen1 to be active")
	}

	// Create a second generation and try to activate it
	gen2ID, _ := CreateGeneration(ctx, "model-b", 768)
	_ = UpdateGenerationStatus(ctx, gen2ID, models.GenerationStatusReady)
	err := UpdateGenerationStatus(ctx, gen2ID, models.GenerationStatusActive)

	// This should fail due to the partial unique index
	if err == nil {
		t.Fatal("expected error when activating second generation, but got nil")
	}

	// Original should still be active
	active, _ = GetActiveGeneration(ctx)
	if active == nil || active.ID != gen1ID {
		t.Error("expected gen1 to still be active")
	}
}

// TestGenerationFailed verifies BUILDING -> FAILED transition.
func TestGenerationFailed(t *testing.T) {
	ctx := testSetup(t)

	genID, _ := CreateGeneration(ctx, "model-fail", 512)
	err := UpdateGenerationStatus(ctx, genID, models.GenerationStatusFailed)
	if err != nil {
		t.Fatalf("UpdateGenerationStatus(FAILED): %v", err)
	}

	gen, _ := GetGenerationByID(ctx, genID)
	if gen.Status != models.GenerationStatusFailed {
		t.Errorf("expected FAILED, got %s", gen.Status)
	}
}

// TestGenerationCounts verifies updating progress counters.
func TestGenerationCounts(t *testing.T) {
	ctx := testSetup(t)

	genID, _ := CreateGeneration(ctx, "model-counts", 1536)
	err := UpdateGenerationCounts(ctx, genID, 100, 75, 5)
	if err != nil {
		t.Fatalf("UpdateGenerationCounts: %v", err)
	}

	gen, _ := GetGenerationByID(ctx, genID)
	if gen.TotalItems != 100 || gen.ProcessedItems != 75 || gen.FailedItems != 5 {
		t.Errorf("expected 100/75/5, got %d/%d/%d", gen.TotalItems, gen.ProcessedItems, gen.FailedItems)
	}
}

// TestChunkInsertAndQuery verifies inserting and retrieving a chunk.
func TestChunkInsertAndQuery(t *testing.T) {
	ctx := testSetup(t)

	genID, _ := CreateGeneration(ctx, "model-test", 3)

	chunk := &models.EmbeddingChunk{
		GenerationID: genID,
		SourceType:   models.SourceTypeExecutionLog,
		SourceID:     "42",
		ChunkIndex:   0,
		Content:      "Backup failed for repository MishraShardendu22/project-alpha: connection refused",
		ContentHash:  contentHash("Backup failed for repository MishraShardendu22/project-alpha: connection refused"),
		Embedding:    []float32{0.1, 0.2, 0.3},
		Metadata:     map[string]interface{}{"repository": "project-alpha", "level": "error"},
	}

	chunkID, err := InsertChunk(ctx, chunk)
	if err != nil {
		t.Fatalf("InsertChunk: %v", err)
	}
	if chunkID == 0 {
		t.Fatal("expected non-zero chunk ID")
	}

	// Verify the chunk was stored
	count, _ := CountChunksForGeneration(ctx, genID)
	if count != 1 {
		t.Errorf("expected 1 chunk, got %d", count)
	}
}

// TestChunkUniqueConstraint verifies duplicate prevention within a generation.
func TestChunkUniqueConstraint(t *testing.T) {
	ctx := testSetup(t)

	genID, _ := CreateGeneration(ctx, "model-unique", 3)

	chunk := &models.EmbeddingChunk{
		GenerationID: genID,
		SourceType:   models.SourceTypeBackupResult,
		SourceID:     "10",
		ChunkIndex:   0,
		Content:      "test content",
		ContentHash:  contentHash("test content"),
		Embedding:    []float32{0.1, 0.2, 0.3},
		Metadata:     map[string]interface{}{},
	}

	_, err := InsertChunk(ctx, chunk)
	if err != nil {
		t.Fatalf("first insert: %v", err)
	}

	// Second insert with same key should fail
	_, err = InsertChunk(ctx, chunk)
	if err == nil {
		t.Fatal("expected error for duplicate chunk, but got nil")
	}
}

// TestChunkCrossGenerationIsolation verifies the same source can exist
// in multiple generations.
func TestChunkCrossGenerationIsolation(t *testing.T) {
	ctx := testSetup(t)

	gen1ID, _ := CreateGeneration(ctx, "model-v1", 3)
	gen2ID, _ := CreateGeneration(ctx, "model-v2", 3)

	for _, genID := range []int{gen1ID, gen2ID} {
		chunk := &models.EmbeddingChunk{
			GenerationID: genID,
			SourceType:   models.SourceTypeInvestigation,
			SourceID:     "abc-123-uuid",
			ChunkIndex:   0,
			Content:      "Why did the backup fail?",
			ContentHash:  contentHash("Why did the backup fail?"),
			Embedding:    []float32{0.1, 0.2, 0.3},
			Metadata:     map[string]interface{}{},
		}
		_, err := InsertChunk(ctx, chunk)
		if err != nil {
			t.Fatalf("insert chunk for gen %d: %v", genID, err)
		}
	}

	// Both generations should have exactly 1 chunk
	c1, _ := CountChunksForGeneration(ctx, gen1ID)
	c2, _ := CountChunksForGeneration(ctx, gen2ID)
	if c1 != 1 || c2 != 1 {
		t.Errorf("expected 1 chunk per generation, got gen1=%d gen2=%d", c1, c2)
	}
}

// TestChunkFTS verifies that inserted content produces searchable tsvector data
// via the GENERATED ALWAYS AS column.
func TestChunkFTS(t *testing.T) {
	ctx := testSetup(t)

	genID, _ := CreateGeneration(ctx, "model-fts", 3)

	chunk := &models.EmbeddingChunk{
		GenerationID: genID,
		SourceType:   models.SourceTypeExecutionLog,
		SourceID:     "99",
		ChunkIndex:   0,
		Content:      "Authentication failed with OAuth token for GitHub Enterprise repository",
		ContentHash:  contentHash("Authentication failed with OAuth token for GitHub Enterprise repository"),
		Embedding:    []float32{0.1, 0.2, 0.3},
		Metadata:     map[string]interface{}{},
	}
	_, err := InsertChunk(ctx, chunk)
	if err != nil {
		t.Fatalf("InsertChunk: %v", err)
	}

	// Search using FTS: should find the chunk
	var count int
	err = Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM embedding_chunks
		 WHERE content_tsv @@ plainto_tsquery('english', $1)
		   AND generation_id = $2`,
		"authentication OAuth", genID,
	).Scan(&count)
	if err != nil {
		t.Fatalf("FTS query: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 FTS match, got %d", count)
	}

	// Negative search: should not match
	err = Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM embedding_chunks
		 WHERE content_tsv @@ plainto_tsquery('english', $1)
		   AND generation_id = $2`,
		"kubernetes deployment", genID,
	).Scan(&count)
	if err != nil {
		t.Fatalf("FTS negative query: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 FTS matches for unrelated query, got %d", count)
	}
}

// TestChunkMetadataJSONB verifies JSONB metadata can be stored and queried.
func TestChunkMetadataJSONB(t *testing.T) {
	ctx := testSetup(t)

	genID, _ := CreateGeneration(ctx, "model-meta", 3)

	metadata := map[string]interface{}{
		"repository_id":   42,
		"repository_name": "MishraShardendu22/project-alpha",
		"severity":        "critical",
		"status":          "failed",
	}

	chunk := &models.EmbeddingChunk{
		GenerationID: genID,
		SourceType:   models.SourceTypeBackupResult,
		SourceID:     "55",
		ChunkIndex:   0,
		Content:      "Backup result for project-alpha",
		ContentHash:  contentHash("Backup result for project-alpha"),
		Embedding:    []float32{0.5, 0.6, 0.7},
		Metadata:     metadata,
	}
	_, err := InsertChunk(ctx, chunk)
	if err != nil {
		t.Fatalf("InsertChunk: %v", err)
	}

	// Query by JSONB metadata
	var count int
	err = Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM embedding_chunks c
		 JOIN embedding_chunk_metadata ecm ON c.id = ecm.chunk_id
		 WHERE ecm.metadata @> $1::jsonb
		   AND c.generation_id = $2`,
		`{"severity": "critical"}`, genID,
	).Scan(&count)
	if err != nil {
		t.Fatalf("JSONB query: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 JSONB match, got %d", count)
	}

	// Retrieve and verify full metadata
	var metadataRaw []byte
	err = Pool.QueryRow(ctx,
		`SELECT ecm.metadata FROM embedding_chunks c
		 JOIN embedding_chunk_metadata ecm ON c.id = ecm.chunk_id
		 WHERE c.generation_id = $1 AND c.source_id = '55'`,
		genID,
	).Scan(&metadataRaw)
	if err != nil {
		t.Fatalf("metadata retrieval: %v", err)
	}

	var retrieved map[string]interface{}
	if err := json.Unmarshal(metadataRaw, &retrieved); err != nil {
		t.Fatalf("unmarshal metadata: %v", err)
	}
	if retrieved["repository_name"] != "MishraShardendu22/project-alpha" {
		t.Errorf("expected repository_name MishraShardendu22/project-alpha, got %v", retrieved["repository_name"])
	}
}

// TestChunkVectorStorage verifies pgvector embedding storage and retrieval.
func TestChunkVectorStorage(t *testing.T) {
	ctx := testSetup(t)

	genID, _ := CreateGeneration(ctx, "model-vec", 4)

	embedding := []float32{0.1, 0.2, 0.3, 0.4}
	chunk := &models.EmbeddingChunk{
		GenerationID: genID,
		SourceType:   models.SourceTypeChatMessage,
		SourceID:     "msg-uuid-1",
		ChunkIndex:   0,
		Content:      "What is the backup status?",
		ContentHash:  contentHash("What is the backup status?"),
		Embedding:    embedding,
		Metadata:     map[string]interface{}{},
	}
	_, err := InsertChunk(ctx, chunk)
	if err != nil {
		t.Fatalf("InsertChunk: %v", err)
	}

	// Retrieve the embedding using pgvector scan
	var vec pgvector.Vector
	err = Pool.QueryRow(ctx,
		`SELECT embedding FROM embedding_chunks WHERE generation_id = $1 AND source_id = 'msg-uuid-1'`,
		genID,
	).Scan(&vec)
	if err != nil {
		t.Fatalf("vector retrieval: %v", err)
	}

	retrieved := vec.Slice()
	if len(retrieved) != 4 {
		t.Fatalf("expected 4-dim vector, got %d", len(retrieved))
	}
	for i, v := range embedding {
		if retrieved[i] != v {
			t.Errorf("vector[%d]: expected %f, got %f", i, v, retrieved[i])
		}
	}
}

// TestGenerationAwareVectorSearch verifies that vector similarity search
// can be restricted to a specific generation, even when multiple generations
// with different dimensions coexist.
func TestGenerationAwareVectorSearch(t *testing.T) {
	ctx := testSetup(t)

	// Generation 1: 3 dimensions
	gen1ID, _ := CreateGeneration(ctx, "model-3d", 3)
	// Generation 2: 5 dimensions
	gen2ID, _ := CreateGeneration(ctx, "model-5d", 5)

	// Insert chunks into gen1 (3-dim)
	for i, emb := range [][]float32{
		{1.0, 0.0, 0.0},
		{0.0, 1.0, 0.0},
		{0.0, 0.0, 1.0},
	} {
		chunk := &models.EmbeddingChunk{
			GenerationID: gen1ID,
			SourceType:   models.SourceTypeExecutionLog,
			SourceID:     fmt.Sprintf("gen1-src-%d", i),
			ChunkIndex:   0,
			Content:      fmt.Sprintf("gen1 content %d", i),
			ContentHash:  contentHash(fmt.Sprintf("gen1 content %d", i)),
			Embedding:    emb,
			Metadata:     map[string]interface{}{},
		}
		if _, err := InsertChunk(ctx, chunk); err != nil {
			t.Fatalf("insert gen1 chunk %d: %v", i, err)
		}
	}

	// Insert chunks into gen2 (5-dim)
	for i, emb := range [][]float32{
		{1.0, 0.0, 0.0, 0.0, 0.0},
		{0.0, 1.0, 0.0, 0.0, 0.0},
	} {
		chunk := &models.EmbeddingChunk{
			GenerationID: gen2ID,
			SourceType:   models.SourceTypeExecutionLog,
			SourceID:     fmt.Sprintf("gen2-src-%d", i),
			ChunkIndex:   0,
			Content:      fmt.Sprintf("gen2 content %d", i),
			ContentHash:  contentHash(fmt.Sprintf("gen2 content %d", i)),
			Embedding:    emb,
			Metadata:     map[string]interface{}{},
		}
		if _, err := InsertChunk(ctx, chunk); err != nil {
			t.Fatalf("insert gen2 chunk %d: %v", i, err)
		}
	}

	// Vector search restricted to gen1 (3-dim query)
	queryVec1 := pgvector.NewVector([]float32{0.9, 0.1, 0.0})
	rows, err := Pool.Query(ctx,
		`SELECT source_id, embedding <=> $1 AS distance
		 FROM embedding_chunks
		 WHERE generation_id = $2
		 ORDER BY embedding <=> $1
		 LIMIT 2`,
		queryVec1, gen1ID,
	)
	if err != nil {
		t.Fatalf("gen1 vector search: %v", err)
	}
	defer rows.Close()

	var gen1Results []string
	for rows.Next() {
		var sourceID string
		var dist float64
		if err := rows.Scan(&sourceID, &dist); err != nil {
			t.Fatalf("scan gen1 result: %v", err)
		}
		gen1Results = append(gen1Results, sourceID)
	}
	if len(gen1Results) != 2 {
		t.Errorf("expected 2 gen1 results, got %d", len(gen1Results))
	}
	// Closest to [0.9, 0.1, 0.0] should be gen1-src-0 ([1,0,0])
	if len(gen1Results) > 0 && gen1Results[0] != "gen1-src-0" {
		t.Errorf("expected nearest neighbor gen1-src-0, got %s", gen1Results[0])
	}

	// Vector search restricted to gen2 (5-dim query)
	queryVec2 := pgvector.NewVector([]float32{0.0, 0.9, 0.1, 0.0, 0.0})
	rows2, err := Pool.Query(ctx,
		`SELECT source_id, embedding <=> $1 AS distance
		 FROM embedding_chunks
		 WHERE generation_id = $2
		 ORDER BY embedding <=> $1
		 LIMIT 2`,
		queryVec2, gen2ID,
	)
	if err != nil {
		t.Fatalf("gen2 vector search: %v", err)
	}
	defer rows2.Close()

	var gen2Results []string
	for rows2.Next() {
		var sourceID string
		var dist float64
		if err := rows2.Scan(&sourceID, &dist); err != nil {
			t.Fatalf("scan gen2 result: %v", err)
		}
		gen2Results = append(gen2Results, sourceID)
	}
	if len(gen2Results) != 2 {
		t.Errorf("expected 2 gen2 results, got %d", len(gen2Results))
	}
	// Closest to [0, 0.9, 0.1, 0, 0] should be gen2-src-1 ([0,1,0,0,0])
	if len(gen2Results) > 0 && gen2Results[0] != "gen2-src-1" {
		t.Errorf("expected nearest neighbor gen2-src-1, got %s", gen2Results[0])
	}
}

// TestForeignKeyEnforcement verifies that chunks with invalid generation_id
// are rejected by the foreign key constraint.
func TestForeignKeyEnforcement(t *testing.T) {
	ctx := testSetup(t)

	chunk := &models.EmbeddingChunk{
		GenerationID: 999999, // Non-existent generation
		SourceType:   models.SourceTypeBackupFix,
		SourceID:     "1",
		ChunkIndex:   0,
		Content:      "orphan chunk",
		ContentHash:  contentHash("orphan chunk"),
		Embedding:    []float32{0.1, 0.2, 0.3},
		Metadata:     map[string]interface{}{},
	}
	_, err := InsertChunk(ctx, chunk)
	if err == nil {
		t.Fatal("expected error for invalid generation_id, but got nil")
	}
}

// TestDeleteChunksForGeneration verifies bulk deletion works correctly.
func TestDeleteChunksForGeneration(t *testing.T) {
	ctx := testSetup(t)

	gen1ID, _ := CreateGeneration(ctx, "model-del-1", 3)
	gen2ID, _ := CreateGeneration(ctx, "model-del-2", 3)

	// Insert 3 chunks into gen1 and 2 chunks into gen2
	for i := 0; i < 3; i++ {
		chunk := &models.EmbeddingChunk{
			GenerationID: gen1ID,
			SourceType:   models.SourceTypeBackupResult,
			SourceID:     fmt.Sprintf("del-%d", i),
			ChunkIndex:   0,
			Content:      fmt.Sprintf("content %d", i),
			ContentHash:  contentHash(fmt.Sprintf("content %d", i)),
			Embedding:    []float32{0.1, 0.2, 0.3},
			Metadata:     map[string]interface{}{},
		}
		InsertChunk(ctx, chunk)
	}
	for i := 0; i < 2; i++ {
		chunk := &models.EmbeddingChunk{
			GenerationID: gen2ID,
			SourceType:   models.SourceTypeBackupResult,
			SourceID:     fmt.Sprintf("keep-%d", i),
			ChunkIndex:   0,
			Content:      fmt.Sprintf("keep content %d", i),
			ContentHash:  contentHash(fmt.Sprintf("keep content %d", i)),
			Embedding:    []float32{0.4, 0.5, 0.6},
			Metadata:     map[string]interface{}{},
		}
		InsertChunk(ctx, chunk)
	}

	// Delete gen1 chunks
	deleted, err := DeleteChunksForGeneration(ctx, gen1ID)
	if err != nil {
		t.Fatalf("DeleteChunksForGeneration: %v", err)
	}
	if deleted != 3 {
		t.Errorf("expected 3 deleted, got %d", deleted)
	}

	// gen1 should have 0 chunks
	c1, _ := CountChunksForGeneration(ctx, gen1ID)
	if c1 != 0 {
		t.Errorf("expected 0 chunks for gen1, got %d", c1)
	}

	// gen2 should still have 2 chunks
	c2, _ := CountChunksForGeneration(ctx, gen2ID)
	if c2 != 2 {
		t.Errorf("expected 2 chunks for gen2, got %d", c2)
	}
}

// TestUpsertChunk verifies that upsert correctly updates existing chunks.
func TestUpsertChunk(t *testing.T) {
	ctx := testSetup(t)

	genID, _ := CreateGeneration(ctx, "model-upsert", 3)

	chunk := &models.EmbeddingChunk{
		GenerationID: genID,
		SourceType:   models.SourceTypeChatMessage,
		SourceID:     "upsert-1",
		ChunkIndex:   0,
		Content:      "original content",
		ContentHash:  contentHash("original content"),
		Embedding:    []float32{0.1, 0.2, 0.3},
		Metadata:     map[string]interface{}{"version": float64(1)},
	}

	id1, err := UpsertChunk(ctx, chunk)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Update content via upsert
	chunk.Content = "updated content"
	chunk.ContentHash = contentHash("updated content")
	chunk.Embedding = []float32{0.4, 0.5, 0.6}
	chunk.Metadata = map[string]interface{}{"version": float64(2)}

	id2, err := UpsertChunk(ctx, chunk)
	if err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	// Should return the same ID (update, not insert)
	if id1 != id2 {
		t.Errorf("expected same ID after upsert, got %d != %d", id1, id2)
	}

	// Verify only 1 chunk exists
	count, _ := CountChunksForGeneration(ctx, genID)
	if count != 1 {
		t.Errorf("expected 1 chunk after upsert, got %d", count)
	}

	// Verify content was updated
	var content string
	Pool.QueryRow(ctx,
		`SELECT content FROM embedding_chunks WHERE id = $1`, id1,
	).Scan(&content)
	if content != "updated content" {
		t.Errorf("expected 'updated content', got '%s'", content)
	}
}

// TestMultiChunkSource verifies a single source can produce multiple chunks.
func TestMultiChunkSource(t *testing.T) {
	ctx := testSetup(t)

	genID, _ := CreateGeneration(ctx, "model-multi", 3)

	for i := 0; i < 3; i++ {
		chunk := &models.EmbeddingChunk{
			GenerationID: genID,
			SourceType:   models.SourceTypeInvestigation,
			SourceID:     "multi-source-1",
			ChunkIndex:   i,
			Content:      fmt.Sprintf("chunk %d of investigation", i),
			ContentHash:  contentHash(fmt.Sprintf("chunk %d of investigation", i)),
			Embedding:    []float32{float32(i) * 0.1, float32(i) * 0.2, float32(i) * 0.3},
			Metadata:     map[string]interface{}{"chunk_index": i},
		}
		_, err := InsertChunk(ctx, chunk)
		if err != nil {
			t.Fatalf("insert chunk %d: %v", i, err)
		}
	}

	count, _ := CountChunksForGeneration(ctx, genID)
	if count != 3 {
		t.Errorf("expected 3 chunks for multi-chunk source, got %d", count)
	}
}

// TestGetActiveGenerationNone verifies GetActiveGeneration returns nil
// when no generation is active.
func TestGetActiveGenerationNone(t *testing.T) {
	ctx := testSetup(t)

	gen, err := GetActiveGeneration(ctx)
	if err != nil {
		t.Fatalf("GetActiveGeneration: %v", err)
	}
	if gen != nil {
		t.Error("expected nil for no active generation")
	}
}

// TestChunkNullEmbedding verifies chunks can be stored without an embedding
// (useful for chunks being built but not yet embedded).
func TestChunkNullEmbedding(t *testing.T) {
	ctx := testSetup(t)

	genID, _ := CreateGeneration(ctx, "model-null-emb", 3)

	chunk := &models.EmbeddingChunk{
		GenerationID: genID,
		SourceType:   models.SourceTypeBackupFix,
		SourceID:     "fix-1",
		ChunkIndex:   0,
		Content:      "fix without embedding yet",
		ContentHash:  contentHash("fix without embedding yet"),
		Embedding:    nil, // No embedding
		Metadata:     map[string]interface{}{},
	}

	id, err := InsertChunk(ctx, chunk)
	if err != nil {
		t.Fatalf("insert null embedding chunk: %v", err)
	}
	if id == 0 {
		t.Fatal("expected non-zero ID")
	}
}

// TestPromoteGenerationToActive verifies atomic promotion to ACTIVE and purging of old active generations.
func TestPromoteGenerationToActive(t *testing.T) {
	ctx := testSetup(t)

	// Create Gen 1 and promote to ACTIVE
	gen1, err := CreateGeneration(ctx, "model-v1", 1536)
	if err != nil {
		t.Fatalf("CreateGeneration 1: %v", err)
	}
	if err := PromoteGenerationToActive(ctx, gen1); err != nil {
		t.Fatalf("PromoteGenerationToActive 1: %v", err)
	}

	active, err := GetActiveGeneration(ctx)
	if err != nil || active == nil || active.ID != gen1 {
		t.Fatalf("expected active generation %d, got %v", gen1, active)
	}

	// Create Gen 2 and promote to ACTIVE
	gen2, err := CreateGeneration(ctx, "model-v2", 1536)
	if err != nil {
		t.Fatalf("CreateGeneration 2: %v", err)
	}
	if err := PromoteGenerationToActive(ctx, gen2); err != nil {
		t.Fatalf("PromoteGenerationToActive 2: %v", err)
	}

	active2, err := GetActiveGeneration(ctx)
	if err != nil || active2 == nil || active2.ID != gen2 {
		t.Fatalf("expected active generation %d, got %v", gen2, active2)
	}

	// Gen 1 should now be purged/deleted
	g1, err := GetGenerationByID(ctx, gen1)
	if err != nil {
		t.Fatalf("GetGenerationByID 1: %v", err)
	}
	if g1 != nil {
		t.Fatalf("expected gen 1 to be purged after gen 2 promotion, got %v", g1)
	}
}

// TestDeleteGeneration verifies explicit deletion of a generation and its cascading chunks.
func TestDeleteGeneration(t *testing.T) {
	ctx := testSetup(t)

	gen, err := CreateGeneration(ctx, "model-to-delete", 1536)
	if err != nil {
		t.Fatalf("CreateGeneration: %v", err)
	}

	chunk := &models.EmbeddingChunk{
		GenerationID: gen,
		SourceType:   models.SourceTypeChatMessage,
		SourceID:     "msg-del",
		ChunkIndex:   0,
		Content:      "delete chunk",
		ContentHash:  contentHash("delete chunk"),
		Embedding:    []float32{0.1, 0.2, 0.3},
		Metadata:     map[string]interface{}{},
	}
	_, err = InsertChunk(ctx, chunk)
	if err != nil {
		t.Fatalf("InsertChunk: %v", err)
	}

	if err := DeleteGeneration(ctx, gen); err != nil {
		t.Fatalf("DeleteGeneration: %v", err)
	}

	g, err := GetGenerationByID(ctx, gen)
	if err != nil {
		t.Fatalf("GetGenerationByID: %v", err)
	}
	if g != nil {
		t.Fatalf("expected generation %d to be deleted, got %v", gen, g)
	}
}

// TestPruneStaleGenerations verifies that non-active generations are pruned and cascade-delete chunks.
func TestPruneStaleGenerations(t *testing.T) {
	ctx := testSetup(t)

	// Create Gen 1 (ACTIVE)
	gen1, _ := CreateGeneration(ctx, "model-active", 1536)
	_ = PromoteGenerationToActive(ctx, gen1)

	// Create Gen 2 (FAILED)
	gen2, _ := CreateGeneration(ctx, "model-failed", 1536)
	_ = UpdateGenerationStatus(ctx, gen2, models.GenerationStatusFailed)

	// Add chunk to Gen 2
	chunk := &models.EmbeddingChunk{
		GenerationID: gen2,
		SourceType:   models.SourceTypeChatMessage,
		SourceID:     "msg-fail",
		ChunkIndex:   0,
		Content:      "stale chunk",
		ContentHash:  contentHash("stale chunk"),
		Embedding:    []float32{0.1, 0.2, 0.3},
		Metadata:     map[string]interface{}{},
	}
	_, _ = InsertChunk(ctx, chunk)

	// Prune
	pruned, err := PruneStaleGenerations(ctx)
	if err != nil {
		t.Fatalf("PruneStaleGenerations: %v", err)
	}
	if pruned == 0 {
		t.Errorf("expected at least 1 pruned generation, got 0")
	}

	// Gen 1 must still exist and be active
	g1, _ := GetGenerationByID(ctx, gen1)
	if g1 == nil || g1.Status != models.GenerationStatusActive {
		t.Errorf("active generation %d was unexpectedly removed or altered", gen1)
	}

	// Gen 2 must be deleted
	g2, _ := GetGenerationByID(ctx, gen2)
	if g2 != nil {
		t.Errorf("expected gen 2 to be deleted, got %v", g2)
	}
}
