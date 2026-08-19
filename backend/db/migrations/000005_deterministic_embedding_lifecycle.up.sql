-- =============================================================================
-- Migration 000005: Deterministic Embedding Lifecycle & Index Optimization
-- =============================================================================

-- 1. Partial indexes for fast failure and error lookups without scanning successful rows
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

-- 2. Partial indexes for commit hash lookups
CREATE INDEX IF NOT EXISTS idx_backup_results_commit
    ON backup_results (commit_hash)
    WHERE commit_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backup_fixes_commit
    ON backup_fixes (commit_hash)
    WHERE commit_hash IS NOT NULL;

-- 3. Backfill any remaining session metadata into normalized ai_session_metadata
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_chat_sessions' AND column_name = 'metadata'
    ) THEN
        INSERT INTO ai_session_metadata (session_id, key, value)
        SELECT
            s.id,
            kv.key,
            kv.value::text
        FROM ai_chat_sessions s,
             jsonb_each(s.metadata) kv
        WHERE s.metadata IS NOT NULL
          AND s.metadata != '{}'::jsonb
        ON CONFLICT (session_id, key) DO NOTHING;

        -- Clean metadata JSONB in ai_chat_sessions to NULL to reclaim space
        UPDATE ai_chat_sessions
        SET metadata = NULL
        WHERE metadata = '{}'::jsonb;
    END IF;
END $$;

-- 4. Clean redundant keys (source_type, source_id, chunk_index) from embedding_chunks.metadata JSONB
UPDATE embedding_chunks
SET metadata = metadata - 'source_type' - 'source_id' - 'chunk_index'
WHERE metadata ? 'source_type' OR metadata ? 'source_id' OR metadata ? 'chunk_index';

-- 5. Safe transactional pruning of obsolete retired/failed generations
-- Cascading foreign keys will remove associated chunks, vectors, and jobs.
DELETE FROM embedding_generations
WHERE status IN ('RETIRED', 'FAILED');

-- 6. Safe cleanup of stale failed embedding jobs older than 6 hours
DELETE FROM embedding_jobs
WHERE status = 'failed'
  AND updated_at < NOW() - INTERVAL '6 hours';
