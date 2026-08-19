-- Enable vector and pg_trgm extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS embedding_generations (
    id              SERIAL PRIMARY KEY,
    model_id        TEXT NOT NULL,
    dimensions      INT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'BUILDING'
                    CHECK (status IN ('BUILDING', 'READY', 'ACTIVE', 'RETIRED', 'FAILED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    retired_at      TIMESTAMPTZ,
    total_items     INT NOT NULL DEFAULT 0,
    processed_items INT NOT NULL DEFAULT 0,
    failed_items    INT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_embedding_generations_single_active
    ON embedding_generations (status) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS embedding_chunks (
    id              SERIAL PRIMARY KEY,
    generation_id   INT NOT NULL REFERENCES embedding_generations(id) ON DELETE CASCADE,
    source_type     TEXT NOT NULL
                    CHECK (source_type IN (
                        'chat_message', 'execution_log', 'investigation',
                        'backup_result', 'backup_fix', 'backup_run', 'analytics_snapshot'
                    )),
    source_id       TEXT NOT NULL,
    chunk_index     INT NOT NULL DEFAULT 0,
    content         TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    embedding       vector,
    metadata        JSONB NOT NULL DEFAULT '{}',
    content_tsv     tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_embedding_chunks_unique_source
    ON embedding_chunks (generation_id, source_type, source_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_embedding_chunks_generation
    ON embedding_chunks (generation_id);

CREATE INDEX IF NOT EXISTS idx_embedding_chunks_source
    ON embedding_chunks (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_embedding_chunks_gen_type
    ON embedding_chunks (generation_id, source_type);

CREATE INDEX IF NOT EXISTS idx_embedding_chunks_fts
    ON embedding_chunks USING GIN (content_tsv);

CREATE INDEX IF NOT EXISTS idx_embedding_chunks_trgm
    ON embedding_chunks USING GIN (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_embedding_chunks_metadata
    ON embedding_chunks USING GIN (metadata);

CREATE TABLE IF NOT EXISTS embedding_jobs (
    id              BIGSERIAL PRIMARY KEY,
    generation_id   INT NOT NULL REFERENCES embedding_generations(id) ON DELETE CASCADE,
    source_type     TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    content_hash    TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    attempt_count   INT NOT NULL DEFAULT 0,
    max_attempts    INT NOT NULL DEFAULT 3,
    error_message   TEXT NOT NULL DEFAULT '',
    claimed_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_embedding_jobs_unique
    ON embedding_jobs (generation_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status
    ON embedding_jobs (generation_id, status);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_claimable
    ON embedding_jobs (generation_id, status, attempt_count)
    WHERE status IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS embedding_indexing_checkpoints (
    source_type     TEXT PRIMARY KEY,
    last_indexed_id BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
