-- Embedding Jobs (work queue for batch processing)
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

-- Embedding Indexing Checkpoints (incremental indexing cursors)
CREATE TABLE IF NOT EXISTS embedding_indexing_checkpoints (
    source_type     TEXT PRIMARY KEY,
    last_indexed_id BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
