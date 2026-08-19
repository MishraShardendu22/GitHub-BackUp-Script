-- =============================================================================
-- Migration 000005: Deterministic Embedding Lifecycle & Schema Normalization
-- =============================================================================

-- 1. Restructure ai_session_metadata to dedicated relational entity with its own ID, session_id FK, and JSONB metadata
DO $$
BEGIN
    -- If ai_session_metadata already exists with 'key' column, convert to new structure
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_session_metadata' AND column_name = 'key'
    ) THEN
        CREATE TEMP TABLE tmp_session_meta AS
        SELECT session_id, jsonb_object_agg(key, value) AS metadata, MIN(created_at) AS created_at
        FROM ai_session_metadata
        GROUP BY session_id;

        DROP TABLE ai_session_metadata CASCADE;

        CREATE TABLE ai_session_metadata (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id  UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
            metadata    JSONB NOT NULL DEFAULT '{}',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_ai_session_metadata_session UNIQUE (session_id)
        );

        INSERT INTO ai_session_metadata (session_id, metadata, created_at, updated_at)
        SELECT session_id, metadata, created_at, created_at
        FROM tmp_session_meta
        ON CONFLICT (session_id) DO NOTHING;

        DROP TABLE tmp_session_meta;
    ELSE
        CREATE TABLE IF NOT EXISTS ai_session_metadata (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id  UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
            metadata    JSONB NOT NULL DEFAULT '{}',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_ai_session_metadata_session UNIQUE (session_id)
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_session_metadata_session
    ON ai_session_metadata (session_id);

-- 2. Migrate any existing non-empty metadata from ai_chat_sessions into ai_session_metadata
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_chat_sessions' AND column_name = 'metadata'
    ) THEN
        INSERT INTO ai_session_metadata (session_id, metadata, created_at, updated_at)
        SELECT
            s.id,
            s.metadata,
            s.created_at,
            s.updated_at
        FROM ai_chat_sessions s
        WHERE s.metadata IS NOT NULL
          AND s.metadata != '{}'::jsonb
        ON CONFLICT (session_id) DO UPDATE
        SET metadata = ai_session_metadata.metadata || EXCLUDED.metadata,
            updated_at = NOW();

        -- Drop the redundant always-null metadata column from ai_chat_sessions completely
        ALTER TABLE ai_chat_sessions DROP COLUMN IF EXISTS metadata;
    END IF;
END $$;

-- 3. Partial indexes for fast failure and error lookups without scanning successful rows
CREATE INDEX IF NOT EXISTS idx_backup_results_errors
    ON backup_results (run_id, status)
    WHERE error_message IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backup_runs_errors
    ON backup_runs (status)
    WHERE error_message IS NOT NULL OR status = 'failed';

CREATE INDEX IF NOT EXISTS idx_investigations_errors
    ON investigations (status)
    WHERE error IS NOT NULL OR status = 'failed';

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_errors
    ON ai_tool_calls (name, success)
    WHERE error IS NOT NULL OR success = FALSE;

-- 4. Partial indexes for commit hash lookups
CREATE INDEX IF NOT EXISTS idx_backup_results_commit
    ON backup_results (commit_hash)
    WHERE commit_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backup_fixes_commit
    ON backup_fixes (commit_hash)
    WHERE commit_hash IS NOT NULL;

-- 5. Clean redundant keys (source_type, source_id, chunk_index) from embedding_chunks.metadata JSONB
UPDATE embedding_chunks
SET metadata = metadata - 'source_type' - 'source_id' - 'chunk_index'
WHERE metadata ? 'source_type' OR metadata ? 'source_id' OR metadata ? 'chunk_index';

-- 6. Safe transactional pruning of obsolete retired/failed generations
DELETE FROM embedding_generations
WHERE status IN ('RETIRED', 'FAILED');

-- 7. Safe cleanup of stale failed embedding jobs older than 6 hours
DELETE FROM embedding_jobs
WHERE status = 'failed'
  AND updated_at < NOW() - INTERVAL '6 hours';
