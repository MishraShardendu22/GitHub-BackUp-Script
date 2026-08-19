-- =============================================================================
-- Migration 002: Schema Normalization & Embedding Lifecycle
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_session_metadata (
    session_id  UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, key)
);

CREATE INDEX IF NOT EXISTS idx_ai_session_metadata_session
    ON ai_session_metadata (session_id);

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

CREATE INDEX IF NOT EXISTS idx_backup_results_commit
    ON backup_results (commit_hash)
    WHERE commit_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backup_fixes_commit
    ON backup_fixes (commit_hash)
    WHERE commit_hash IS NOT NULL;
