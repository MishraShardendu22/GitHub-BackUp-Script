package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// GetCheckpoint returns the last_indexed_id for a source type. Returns 0 if no row exists.
func GetCheckpoint(ctx context.Context, sourceType string) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var lastIndexedID int64
	err := Pool.QueryRow(ctx, `
		SELECT last_indexed_id 
		FROM embedding_indexing_checkpoints 
		WHERE source_type = $1
	`, sourceType).Scan(&lastIndexedID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return 0, fmt.Errorf("failed to get checkpoint for source_type %s: %w", sourceType, err)
	}

	return lastIndexedID, nil
}

// UpdateCheckpoint upserts the checkpoint row (INSERT ... ON CONFLICT DO UPDATE).
func UpdateCheckpoint(ctx context.Context, sourceType string, lastIndexedID int64) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	_, err := Pool.Exec(ctx, `
		INSERT INTO embedding_indexing_checkpoints (source_type, last_indexed_id)
		VALUES ($1, $2)
		ON CONFLICT (source_type) DO UPDATE
		SET last_indexed_id = EXCLUDED.last_indexed_id,
		    updated_at = NOW()
	`, sourceType, lastIndexedID)

	if err != nil {
		return fmt.Errorf("failed to update checkpoint for source_type %s: %w", sourceType, err)
	}

	return nil
}
