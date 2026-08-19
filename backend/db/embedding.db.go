package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/models"
	pgvector "github.com/pgvector/pgvector-go"
)

// CreateGeneration inserts a new embedding generation in BUILDING status.
// Returns the new generation's ID.
func CreateGeneration(ctx context.Context, modelID string, dimensions int) (int, error) {
	var id int
	err := Pool.QueryRow(ctx,
		`INSERT INTO embedding_generations (model_id, dimensions, status)
		 VALUES ($1, $2, 'BUILDING')
		 RETURNING id`,
		modelID, dimensions,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("create generation: %w", err)
	}
	return id, nil
}

// GetActiveGeneration returns the single ACTIVE generation, or nil if none exists.
func GetActiveGeneration(ctx context.Context) (*models.EmbeddingGeneration, error) {
	return getGenerationByCondition(ctx, "status = 'ACTIVE'")
}

// GetGenerationByID returns a generation by its ID, or nil if not found.
func GetGenerationByID(ctx context.Context, id int) (*models.EmbeddingGeneration, error) {
	return getGenerationByCondition(ctx, fmt.Sprintf("id = %d", id))
}

// getGenerationByCondition is an internal helper to scan a generation row.
func getGenerationByCondition(ctx context.Context, where string) (*models.EmbeddingGeneration, error) {
	query := fmt.Sprintf(`
		SELECT id, model_id, dimensions, status,
		       created_at, activated_at, completed_at, retired_at,
		       total_items, processed_items, failed_items
		FROM embedding_generations
		WHERE %s
		LIMIT 1`, where)

	g := &models.EmbeddingGeneration{}
	err := Pool.QueryRow(ctx, query).Scan(
		&g.ID, &g.ModelID, &g.Dimensions, &g.Status,
		&g.CreatedAt, &g.ActivatedAt, &g.CompletedAt, &g.RetiredAt,
		&g.TotalItems, &g.ProcessedItems, &g.FailedItems,
	)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("get generation (%s): %w", where, err)
	}
	return g, nil
}

// UpdateGenerationStatus transitions a generation to a new status, setting the
// appropriate timestamp (activated_at, completed_at, retired_at) automatically.
func UpdateGenerationStatus(ctx context.Context, id int, status models.GenerationStatus) error {
	if !status.Valid() {
		return fmt.Errorf("invalid generation status: %s", status)
	}

	now := time.Now().UTC()
	var query string

	switch status {
	case models.GenerationStatusReady:
		query = `UPDATE embedding_generations SET status = $1, completed_at = $2 WHERE id = $3`
	case models.GenerationStatusActive:
		query = `UPDATE embedding_generations SET status = $1, activated_at = $2 WHERE id = $3`
	case models.GenerationStatusRetired:
		query = `UPDATE embedding_generations SET status = $1, retired_at = $2 WHERE id = $3`
	default:
		// BUILDING, FAILED — no special timestamp
		query = `UPDATE embedding_generations SET status = $1 WHERE id = $3`
	}

	tag, err := Pool.Exec(ctx, query, string(status), now, id)
	if err != nil {
		return fmt.Errorf("update generation status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("generation %d not found", id)
	}
	return nil
}

// UpdateGenerationCounts updates the progress counters for a generation.
func UpdateGenerationCounts(ctx context.Context, id int, total, processed, failed int) error {
	tag, err := Pool.Exec(ctx,
		`UPDATE embedding_generations
		 SET total_items = $1, processed_items = $2, failed_items = $3
		 WHERE id = $4`,
		total, processed, failed, id,
	)
	if err != nil {
		return fmt.Errorf("update generation counts: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("generation %d not found", id)
	}
	return nil
}

// InsertChunk inserts a new embedding chunk. Returns the new chunk's ID.
func InsertChunk(ctx context.Context, chunk *models.EmbeddingChunk) (int, error) {
	var metadataArg interface{}
	if len(chunk.Metadata) > 0 {
		metadataJSON, err := json.Marshal(chunk.Metadata)
		if err != nil {
			return 0, fmt.Errorf("marshal metadata: %w", err)
		}
		metadataArg = metadataJSON
	}

	var embeddingArg interface{}
	if len(chunk.Embedding) > 0 {
		embeddingArg = pgvector.NewVector(chunk.Embedding)
	}

	var id int
	err := Pool.QueryRow(ctx,
		`INSERT INTO embedding_chunks
		 (generation_id, source_type, source_id, chunk_index, content, content_hash, embedding, metadata, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		 RETURNING id`,
		chunk.GenerationID,
		string(chunk.SourceType),
		chunk.SourceID,
		chunk.ChunkIndex,
		chunk.Content,
		chunk.ContentHash,
		embeddingArg,
		metadataArg,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("insert chunk: %w", err)
	}
	return id, nil
}

// UpsertChunk inserts a new embedding chunk or updates an existing one
// (matched by generation_id + source_type + source_id + chunk_index).
// Returns the chunk ID.
func UpsertChunk(ctx context.Context, chunk *models.EmbeddingChunk) (int, error) {
	var metadataArg interface{}
	if len(chunk.Metadata) > 0 {
		metadataJSON, err := json.Marshal(chunk.Metadata)
		if err != nil {
			return 0, fmt.Errorf("marshal metadata: %w", err)
		}
		metadataArg = metadataJSON
	}

	var embeddingArg interface{}
	if len(chunk.Embedding) > 0 {
		embeddingArg = pgvector.NewVector(chunk.Embedding)
	}

	var id int
	err := Pool.QueryRow(ctx,
		`INSERT INTO embedding_chunks
		 (generation_id, source_type, source_id, chunk_index, content, content_hash, embedding, metadata, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		 ON CONFLICT (generation_id, source_type, source_id, chunk_index)
		 DO UPDATE SET
		   content = EXCLUDED.content,
		   content_hash = EXCLUDED.content_hash,
		   embedding = EXCLUDED.embedding,
		   metadata = EXCLUDED.metadata,
		   updated_at = NOW()
		 RETURNING id`,
		chunk.GenerationID,
		string(chunk.SourceType),
		chunk.SourceID,
		chunk.ChunkIndex,
		chunk.Content,
		chunk.ContentHash,
		embeddingArg,
		metadataArg,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("upsert chunk: %w", err)
	}
	return id, nil
}

// DeleteChunksForGeneration removes all chunks belonging to a generation.
// Returns the number of deleted rows.
func DeleteChunksForGeneration(ctx context.Context, generationID int) (int64, error) {
	tag, err := Pool.Exec(ctx,
		`DELETE FROM embedding_chunks WHERE generation_id = $1`,
		generationID,
	)
	if err != nil {
		return 0, fmt.Errorf("delete chunks for generation %d: %w", generationID, err)
	}
	return tag.RowsAffected(), nil
}

// CountChunksForGeneration returns the number of chunks in a generation.
func CountChunksForGeneration(ctx context.Context, generationID int) (int, error) {
	var count int
	err := Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM embedding_chunks WHERE generation_id = $1`,
		generationID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count chunks for generation %d: %w", generationID, err)
	}
	return count, nil
}

// PromoteGenerationToActive transactionally transitions a generation to ACTIVE,
// demoting any currently ACTIVE generation to RETIRED, and setting appropriate timestamps.
func PromoteGenerationToActive(ctx context.Context, generationID int) error {
	tx, err := Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin promotion tx: %w", err)
	}
	defer tx.Rollback(ctx) // nolint:errcheck

	now := time.Now().UTC()

	// Demote current active generation if any
	_, err = tx.Exec(ctx,
		`UPDATE embedding_generations
		 SET status = 'RETIRED', retired_at = $1
		 WHERE status = 'ACTIVE' AND id != $2`,
		now, generationID,
	)
	if err != nil {
		return fmt.Errorf("demote active generation: %w", err)
	}

	// Promote new generation to active
	tag, err := tx.Exec(ctx,
		`UPDATE embedding_generations
		 SET status = 'ACTIVE', activated_at = $1, completed_at = COALESCE(completed_at, $1)
		 WHERE id = $2`,
		now, generationID,
	)
	if err != nil {
		return fmt.Errorf("promote generation %d to active: %w", generationID, err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("generation %d not found", generationID)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit promotion tx: %w", err)
	}

	return nil
}

// PruneStaleGenerations deletes all RETIRED and FAILED generations.
// Chunks and jobs are automatically removed via ON DELETE CASCADE.
func PruneStaleGenerations(ctx context.Context) (int64, error) {
	tag, err := Pool.Exec(ctx,
		`DELETE FROM embedding_generations WHERE status IN ('RETIRED', 'FAILED')`,
	)
	if err != nil {
		return 0, fmt.Errorf("prune stale generations: %w", err)
	}
	return tag.RowsAffected(), nil
}

// PruneStaleEmbeddingJobs deletes failed jobs older than the specified duration.
func PruneStaleEmbeddingJobs(ctx context.Context, olderThan time.Duration) (int64, error) {
	threshold := time.Now().UTC().Add(-olderThan)
	tag, err := Pool.Exec(ctx,
		`DELETE FROM embedding_jobs WHERE status = 'failed' AND updated_at < $1`,
		threshold,
	)
	if err != nil {
		return 0, fmt.Errorf("prune stale embedding jobs: %w", err)
	}
	return tag.RowsAffected(), nil
}

