package models

import (
	"time"
)

// GenerationStatus represents the lifecycle state of an embedding generation.
type GenerationStatus string

const (
	GenerationStatusBuilding GenerationStatus = "BUILDING"
	GenerationStatusReady    GenerationStatus = "READY"
	GenerationStatusActive   GenerationStatus = "ACTIVE"
	GenerationStatusRetired  GenerationStatus = "RETIRED"
	GenerationStatusFailed   GenerationStatus = "FAILED"
)

// Valid returns true if the status is one of the defined generation statuses.
func (s GenerationStatus) Valid() bool {
	switch s {
	case GenerationStatusBuilding,
		GenerationStatusReady,
		GenerationStatusActive,
		GenerationStatusRetired,
		GenerationStatusFailed:
		return true
	}
	return false
}

// SourceType identifies which table an embedding chunk's source record came from.
type SourceType string

const (
	SourceTypeChatMessage   SourceType = "chat_message"
	SourceTypeExecutionLog  SourceType = "execution_log"
	SourceTypeInvestigation SourceType = "investigation"
	SourceTypeBackupResult  SourceType = "backup_result"
	SourceTypeBackupFix     SourceType = "backup_fix"
)

// Valid returns true if the source type is one of the defined source types.
func (s SourceType) Valid() bool {
	switch s {
	case SourceTypeChatMessage,
		SourceTypeExecutionLog,
		SourceTypeInvestigation,
		SourceTypeBackupResult,
		SourceTypeBackupFix:
		return true
	}
	return false
}

/*
EmbeddingGeneration represents a complete embedding index built with a specific
model and dimension. Its lifecycle is:

	BUILDING -> READY -> ACTIVE -> RETIRED
	BUILDING -> FAILED

Only one generation may be ACTIVE at any time (enforced by a partial unique
index in PostgreSQL). Multiple generations can coexist during reindexing
(e.g., gen 20 ACTIVE while gen 21 is BUILDING).

Field order is intentionally optimized for struct alignment.
See app.models.go for alignment documentation.
*/
type EmbeddingGeneration struct {
	CreatedAt   time.Time  `json:"created_at"`
	ActivatedAt *time.Time `json:"activated_at"`
	CompletedAt *time.Time `json:"completed_at"`
	RetiredAt   *time.Time `json:"retired_at"`

	ModelID string           `json:"model_id"`
	Status  GenerationStatus `json:"status"`

	ID             int `json:"id"`
	Dimensions     int `json:"dimensions"`
	TotalItems     int `json:"total_items"`
	ProcessedItems int `json:"processed_items"`
	FailedItems    int `json:"failed_items"`
}

/*
EmbeddingChunk represents a single embedded text fragment from a source record.

A source record (e.g., a chat message or execution log) may produce multiple
chunks. Each chunk belongs to exactly one generation. The same source can exist
in multiple generations during reindexing.

Uniqueness is enforced by (generation_id, source_type, source_id, chunk_index).

The embedding column uses pgvector and has no fixed dimension — different
generations may use different embedding dimensions.

Field order is intentionally optimized for struct alignment.
*/
type EmbeddingChunk struct {
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	SourceType  SourceType `json:"source_type"`
	SourceID    string     `json:"source_id"`
	Content     string     `json:"content"`
	ContentHash string     `json:"content_hash"`

	// Embedding is stored as []float32. Use pgvector.NewVector() for scanning.
	Embedding []float32              `json:"embedding,omitempty"`
	Metadata  map[string]interface{} `json:"metadata"`

	ID           int `json:"id"`
	GenerationID int `json:"generation_id"`
	ChunkIndex   int `json:"chunk_index"`
}
