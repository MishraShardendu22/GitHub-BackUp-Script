-- =============================================================================
-- Migration 000004: Cleanup Stale Embedding Generations, Jobs, and Errors
-- =============================================================================

-- 1. Cascade delete all stale RETIRED and FAILED embedding generations
--    (Foreign keys with ON DELETE CASCADE will automatically remove their
--     embedding_chunks and embedding_jobs)
DELETE FROM embedding_generations
WHERE status IN ('RETIRED', 'FAILED');

-- 2. Delete orphaned or obsolete failed embedding jobs from previous generation attempts
DELETE FROM embedding_jobs
WHERE status = 'failed'
  AND updated_at < NOW() - INTERVAL '6 hours';

-- 3. Clean legacy empty string errors in investigations to clean NULLs
UPDATE investigations
SET error = NULL
WHERE error = '' OR error = 'EMPTY_STRING';

-- 4. Clean legacy empty string errors in backup_runs
UPDATE backup_runs
SET error_message = NULL
WHERE error_message = '' OR error_message = 'EMPTY_STRING';
