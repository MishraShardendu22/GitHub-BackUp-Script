-- =============================================================================
-- Migration 000003: Normalize Session Metadata & Cleanup Empty String Defaults
-- =============================================================================

-- 1. Create normalized session metadata table
CREATE TABLE IF NOT EXISTS ai_session_metadata (
    session_id  UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, key)
);

CREATE INDEX IF NOT EXISTS idx_ai_session_metadata_session
    ON ai_session_metadata (session_id);

-- 2. Migrate existing non-empty metadata JSONB into ai_session_metadata
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
    END IF;
END $$;

-- 3. Add 1-to-1 unique index on analytics_snapshots (run_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_snapshots_run_id_unique
    ON analytics_snapshots (run_id) WHERE run_id IS NOT NULL;

-- 4. Clean up legacy empty strings to clean NULLs
UPDATE backup_results
SET error_message = NULL
WHERE error_message = '' OR error_message = 'EMPTY_STRING';

UPDATE backup_runs
SET error_message = NULL
WHERE error_message = '' OR error_message = 'EMPTY_STRING';

UPDATE backup_fixes
SET commit_hash = NULL
WHERE commit_hash = '' OR commit_hash = 'EMPTY_STRING';

UPDATE analytics_snapshots
SET head_commit = NULL
WHERE head_commit = '' OR head_commit = 'EMPTY_STRING';

UPDATE analytics_snapshots
SET head_commit_message = NULL
WHERE head_commit_message = '' OR head_commit_message = 'EMPTY_STRING';

-- 5. Alter column defaults to NULL instead of empty strings
ALTER TABLE backup_results ALTER COLUMN error_message DROP DEFAULT;
ALTER TABLE backup_results ALTER COLUMN error_message SET DEFAULT NULL;

ALTER TABLE backup_runs ALTER COLUMN error_message DROP DEFAULT;
ALTER TABLE backup_runs ALTER COLUMN error_message SET DEFAULT NULL;

ALTER TABLE backup_fixes ALTER COLUMN commit_hash DROP DEFAULT;
ALTER TABLE backup_fixes ALTER COLUMN commit_hash SET DEFAULT NULL;
