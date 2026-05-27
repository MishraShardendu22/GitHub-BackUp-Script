-- Backup runs (each execution of the worker)
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

-- Per-repo backup results
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

-- Execution logs from worker
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

-- AI conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
    id SERIAL PRIMARY KEY,
    title TEXT DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI messages
CREATE TABLE IF NOT EXISTS ai_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tokens_used INT DEFAULT 0,
    web_search BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id);

-- Report history
CREATE TABLE IF NOT EXISTS report_history (
    id SERIAL PRIMARY KEY,
    report_type TEXT NOT NULL,
    recipients TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    error_message TEXT DEFAULT '',
    sent_at TIMESTAMPTZ DEFAULT NOW()
);
