-- =============================================================================
-- Migration 000003 Down: Revert Session Metadata Normalization
-- =============================================================================

DROP INDEX IF EXISTS idx_analytics_snapshots_run_id_unique;
DROP TABLE IF EXISTS ai_session_metadata CASCADE;
