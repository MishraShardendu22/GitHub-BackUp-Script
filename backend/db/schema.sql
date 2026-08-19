CREATE TABLE IF NOT EXISTS backup_runs (
    id SERIAL PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_repos INT DEFAULT 0,
    successful INT DEFAULT 0,
    failed INT DEFAULT 0,
    skipped INT DEFAULT 0,
    duration_ms BIGINT DEFAULT 0,
    error_message TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS backup_results (
    id SERIAL PRIMARY KEY,
    run_id INT REFERENCES backup_runs(id) ON DELETE CASCADE,
    repo_full_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    commit_hash TEXT DEFAULT '',
    archive_size_bytes BIGINT DEFAULT 0,
    duration_ms BIGINT DEFAULT 0,
    error_message TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_logs (
    id SERIAL PRIMARY KEY,
    run_id INT REFERENCES backup_runs(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    repository TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_execution_logs_run ON execution_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_time ON execution_logs(created_at);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id SERIAL PRIMARY KEY,
    run_id INT REFERENCES backup_runs(id) ON DELETE SET NULL,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    head_commit TEXT DEFAULT '',
    head_commit_message TEXT DEFAULT '',
    head_commit_at TIMESTAMPTZ,
    total_commits INT DEFAULT 0,
    branch_count INT DEFAULT 0,
    tag_count INT DEFAULT 0,
    tracked_files INT DEFAULT 0,
    total_blob_size_bytes BIGINT DEFAULT 0,
    avg_blob_size_bytes BIGINT DEFAULT 0,
    largest_blob_path TEXT DEFAULT '',
    largest_blob_size_bytes BIGINT DEFAULT 0,
    archive_count INT DEFAULT 0,
    total_archive_size_bytes BIGINT DEFAULT 0,
    avg_archive_size_bytes BIGINT DEFAULT 0,
    largest_archive_path TEXT DEFAULT '',
    largest_archive_size_bytes BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_time ON analytics_snapshots(captured_at);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_run ON analytics_snapshots(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_snapshots_run_id_unique ON analytics_snapshots(run_id) WHERE run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_session_metadata (
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, key)
);
CREATE INDEX IF NOT EXISTS idx_ai_session_metadata_session ON ai_session_metadata (session_id);

CREATE TABLE IF NOT EXISTS backup_fixes (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    commit_hash TEXT DEFAULT '',
    author TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_run_fixes (
    run_id INT REFERENCES backup_runs(id) ON DELETE CASCADE,
    fix_id INT REFERENCES backup_fixes(id) ON DELETE CASCADE,
    PRIMARY KEY (run_id, fix_id)
);

CREATE INDEX IF NOT EXISTS idx_backup_run_fixes_run ON backup_run_fixes(run_id);
CREATE INDEX IF NOT EXISTS idx_backup_run_fixes_fix ON backup_run_fixes(fix_id);

CREATE INDEX IF NOT EXISTS idx_backup_results_errors ON backup_results (run_id, status) WHERE error_message IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_backup_runs_errors ON backup_runs (status) WHERE error_message IS NOT NULL OR status = 'failed';
CREATE INDEX IF NOT EXISTS idx_backup_results_commit ON backup_results (commit_hash) WHERE commit_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_backup_fixes_commit ON backup_fixes (commit_hash) WHERE commit_hash IS NOT NULL;

-- =============================================================================
-- Phase 1: Retrieval Foundation (pgvector + FTS + pg_trgm)
-- =============================================================================

-- Enable pgvector for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for trigram-based fuzzy/substring matching
-- Justified by existing data: repo names, error messages, file paths, commit hashes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------------
-- Embedding Generations
-- Each generation represents a complete embedding index built with a specific
-- model and dimension. Lifecycle: BUILDING -> READY -> ACTIVE -> RETIRED
-- (FAILED is reachable from BUILDING).
-- -----------------------------------------------------------------------------
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

-- Invariant 1: At most one generation can be ACTIVE at any time.
-- This partial unique index enforces it at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_embedding_generations_single_active
    ON embedding_generations (status) WHERE status = 'ACTIVE';

-- -----------------------------------------------------------------------------
-- Embedding Chunks
-- Each chunk is a piece of text from a source record, embedded with a specific
-- generation's model. A single source record can produce multiple chunks.
-- Different generations can contain chunks for the same source (blue/green).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS embedding_chunks (
    id              SERIAL PRIMARY KEY,
    generation_id   INT NOT NULL REFERENCES embedding_generations(id) ON DELETE CASCADE,
    source_type     TEXT NOT NULL
                    CHECK (source_type IN (
                        'chat_message', 'execution_log', 'investigation',
                        'backup_result', 'backup_fix'
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

-- Uniqueness: prevent duplicate chunks within a generation.
-- The same source can exist in multiple generations (required for reindexing).
CREATE UNIQUE INDEX IF NOT EXISTS idx_embedding_chunks_unique_source
    ON embedding_chunks (generation_id, source_type, source_id, chunk_index);

-- Query: find all chunks for a generation (used by search, cleanup)
CREATE INDEX IF NOT EXISTS idx_embedding_chunks_generation
    ON embedding_chunks (generation_id);

-- Query: find all chunks for a specific source across generations (incremental indexing)
CREATE INDEX IF NOT EXISTS idx_embedding_chunks_source
    ON embedding_chunks (source_type, source_id);

-- Query: find all chunks of a type within a generation (type-filtered search)
CREATE INDEX IF NOT EXISTS idx_embedding_chunks_gen_type
    ON embedding_chunks (generation_id, source_type);

-- FTS: full-text search on content via generated tsvector column
CREATE INDEX IF NOT EXISTS idx_embedding_chunks_fts
    ON embedding_chunks USING GIN (content_tsv);

-- Trigram: fuzzy/substring search for technical identifiers
-- (repo names, error codes, file paths, URLs, package names)
CREATE INDEX IF NOT EXISTS idx_embedding_chunks_trgm
    ON embedding_chunks USING GIN (content gin_trgm_ops);

-- JSONB: metadata filtering (repository_id, severity, status, user_id, etc.)
CREATE INDEX IF NOT EXISTS idx_embedding_chunks_metadata
    ON embedding_chunks USING GIN (metadata);

-- NOTE: Vector (HNSW) indexes are NOT created here.
-- They are generation-specific partial indexes with fixed dimensions,
-- created dynamically in Phase 5 when a generation is built.
-- Example future index:
--   CREATE INDEX idx_hnsw_gen_10
--       ON embedding_chunks USING hnsw (embedding vector_cosine_ops)
--       WHERE generation_id = 10;

-- =============================================================================
-- Phase 2: Embedding Job Queue & Checkpoints
-- =============================================================================

-- Embedding Jobs — durable work queue for batch embedding processing.
-- Jobs are claimed atomically using FOR UPDATE SKIP LOCKED.
-- At-least-once semantics with idempotent UpsertChunk writes.
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

-- Unique constraint: one job per source record per generation
CREATE UNIQUE INDEX IF NOT EXISTS idx_embedding_jobs_unique
    ON embedding_jobs (generation_id, source_type, source_id);

-- Query: find jobs by status within a generation
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status
    ON embedding_jobs (generation_id, status);

-- Query: efficiently find claimable jobs (pending or retryable failed)
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_claimable
    ON embedding_jobs (generation_id, status, attempt_count)
    WHERE status IN ('pending', 'failed');

-- Embedding Indexing Checkpoints — cursor-based incremental indexing.
-- Stores the last processed ID for each source type to enable
-- resumable, fault-tolerant scanning of source tables.
CREATE TABLE IF NOT EXISTS embedding_indexing_checkpoints (
    source_type     TEXT PRIMARY KEY,
    last_indexed_id BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);