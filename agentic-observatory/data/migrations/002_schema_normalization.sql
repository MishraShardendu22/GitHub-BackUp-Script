-- =============================================================================
-- Migration 002: Schema Normalization & Embedding Lifecycle
-- =============================================================================

DO $$
BEGIN
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

-- Drop obsolete metadata column from ai_chat_sessions if present
ALTER TABLE ai_chat_sessions DROP COLUMN IF EXISTS metadata;

-- Normalize analytics_snapshots: drop redundant surrogate id column and use run_id as primary key
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'analytics_snapshots' AND column_name = 'id'
    ) THEN
        ALTER TABLE analytics_snapshots DROP CONSTRAINT IF EXISTS analytics_snapshots_pkey;
        ALTER TABLE analytics_snapshots DROP CONSTRAINT IF EXISTS analytics_snapshots_run_id_key;
        DROP INDEX IF EXISTS idx_analytics_snapshots_run_id_unique;
        DROP INDEX IF EXISTS idx_analytics_snapshots_run;
        ALTER TABLE analytics_snapshots DROP COLUMN IF EXISTS id;
        ALTER TABLE analytics_snapshots ADD CONSTRAINT analytics_snapshots_pkey PRIMARY KEY (run_id);
    END IF;
END $$;

-- Normalize backup_runs: extract into backup_run_errors and drop error_message column
CREATE TABLE IF NOT EXISTS backup_run_errors (
    id SERIAL PRIMARY KEY,
    run_id INT NOT NULL UNIQUE REFERENCES backup_runs(id) ON DELETE CASCADE,
    error_message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backup_run_errors_run ON backup_run_errors(run_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'backup_runs' AND column_name = 'error_message'
    ) THEN
        INSERT INTO backup_run_errors (run_id, error_message)
        SELECT id, error_message
        FROM backup_runs
        WHERE error_message IS NOT NULL
          AND error_message != ''
          AND error_message != 'EMPTY_STRING'
        ON CONFLICT (run_id) DO UPDATE
        SET error_message = EXCLUDED.error_message;

        ALTER TABLE backup_runs DROP COLUMN IF EXISTS error_message;
    END IF;
END $$;

-- Normalize ai_tool_calls: extract into ai_tool_call_args and ai_tool_call_errors
CREATE TABLE IF NOT EXISTS ai_tool_call_args (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_call_id UUID NOT NULL UNIQUE REFERENCES ai_tool_calls(id) ON DELETE CASCADE,
    args JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_tool_call_args_tool ON ai_tool_call_args(tool_call_id);

CREATE TABLE IF NOT EXISTS ai_tool_call_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_call_id UUID NOT NULL UNIQUE REFERENCES ai_tool_calls(id) ON DELETE CASCADE,
    error TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_tool_call_errors_tool ON ai_tool_call_errors(tool_call_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_tool_calls' AND column_name = 'args'
    ) THEN
        INSERT INTO ai_tool_call_args (tool_call_id, args)
        SELECT id, args
        FROM ai_tool_calls
        WHERE args IS NOT NULL AND args != '{}'::jsonb
        ON CONFLICT (tool_call_id) DO UPDATE
        SET args = EXCLUDED.args;

        ALTER TABLE ai_tool_calls DROP COLUMN IF EXISTS args;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_tool_calls' AND column_name = 'error'
    ) THEN
        INSERT INTO ai_tool_call_errors (tool_call_id, error)
        SELECT id, error
        FROM ai_tool_calls
        WHERE error IS NOT NULL AND error != '' AND error != 'null' AND error != 'EMPTY_STRING'
        ON CONFLICT (tool_call_id) DO UPDATE
        SET error = EXCLUDED.error;

        ALTER TABLE ai_tool_calls DROP COLUMN IF EXISTS error;
    END IF;
END $$;

UPDATE investigations
SET error = NULL
WHERE error = '' OR error = 'null' OR error = 'EMPTY_STRING';

UPDATE ai_reports
SET error_message = NULL
WHERE error_message = '' OR error_message = 'null' OR error_message = 'EMPTY_STRING';

CREATE INDEX IF NOT EXISTS idx_backup_results_errors
    ON backup_results (run_id, status)
    WHERE error_message IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backup_runs_status_failed
    ON backup_runs (status)
    WHERE status = 'failed';

CREATE INDEX IF NOT EXISTS idx_investigations_errors
    ON investigations (status)
    WHERE error IS NOT NULL OR status = 'failed';

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_success_false
    ON ai_tool_calls (name)
    WHERE success = FALSE;

CREATE INDEX IF NOT EXISTS idx_backup_results_commit
    ON backup_results (commit_hash)
    WHERE commit_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backup_fixes_commit
    ON backup_fixes (commit_hash)
    WHERE commit_hash IS NOT NULL;

-- Normalize embedding_chunks metadata: clean redundant relational keys and set empty JSON objects to SQL NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'embedding_chunks' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE embedding_chunks ALTER COLUMN metadata DROP NOT NULL;
        ALTER TABLE embedding_chunks ALTER COLUMN metadata DROP DEFAULT;
        ALTER TABLE embedding_chunks ALTER COLUMN metadata SET DEFAULT NULL;

        UPDATE embedding_chunks
        SET metadata = metadata - 'source_type' - 'source_id' - 'chunk_index'
        WHERE metadata ? 'source_type' OR metadata ? 'source_id' OR metadata ? 'chunk_index';

        UPDATE embedding_chunks
        SET metadata = NULL
        WHERE metadata = '{}'::jsonb;
    END IF;
END $$;

-- Fix any active/ready/retired generations missing completed_at or having active with retired_at
UPDATE embedding_generations
SET completed_at = COALESCE(activated_at, created_at, NOW())
WHERE completed_at IS NULL AND status IN ('READY', 'ACTIVE', 'RETIRED');

UPDATE embedding_generations
SET retired_at = NULL
WHERE status = 'ACTIVE' AND retired_at IS NOT NULL;

-- Normalize embedding_jobs error_message: drop NOT NULL, drop DEFAULT, convert EMPTY_STRING/empty strings to SQL NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'embedding_jobs' AND column_name = 'error_message'
    ) THEN
        ALTER TABLE embedding_jobs ALTER COLUMN error_message DROP NOT NULL;
        ALTER TABLE embedding_jobs ALTER COLUMN error_message DROP DEFAULT;
        ALTER TABLE embedding_jobs ALTER COLUMN error_message SET DEFAULT NULL;
        UPDATE embedding_jobs
        SET error_message = NULL
        WHERE error_message = '' OR error_message = 'EMPTY_STRING' OR error_message = 'null';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_errors
    ON embedding_jobs (generation_id, status)
    WHERE error_message IS NOT NULL;
