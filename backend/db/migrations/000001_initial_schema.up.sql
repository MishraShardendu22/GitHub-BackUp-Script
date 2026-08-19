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
