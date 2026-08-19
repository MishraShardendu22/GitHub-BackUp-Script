-- =============================================================================
-- Migration 000005 Down: Revert indexes
-- =============================================================================

DROP INDEX IF EXISTS idx_backup_results_errors;
DROP INDEX IF EXISTS idx_backup_runs_errors;
DROP INDEX IF EXISTS idx_investigations_errors;
DROP INDEX IF EXISTS idx_ai_tool_calls_errors;
DROP INDEX IF EXISTS idx_backup_results_commit;
DROP INDEX IF EXISTS idx_backup_fixes_commit;
