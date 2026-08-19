# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Backup Observatory (GitHub Backup)
- Worker (CLI) for cloning, archiving, and pushing GitHub repositories
- Backend (Dashboard/API) with PostgreSQL-backed metrics, run history, and live logs
- WebSocket endpoint for real-time log streaming
- Dedicated Analytics section with historical charts, metrics, and storage summary
- Paginated table views for run history and Git repository snapshots
- Frontend dashboard built with Next.js, Tailwind CSS, and Recharts
- SSH multiplexing configuration for multiple GitHub accounts
- SQLite metadata tracking for repo hash deduplication and failure logging
- Parallel repository processing with `parallelHashCheck` and `parallelCloneAndArchive`
- Automatic large-file detection (archives >95MB are skipped)
- AI assistant layer (agentic-observatory) with OpenRouter integration and streaming chat
- Email report delivery via SMTP from the AI agent
- JWT-authenticated chat API with session management
- Semantic search over backup metadata using pgvector embeddings
- PostgreSQL Schema Normalization & Migration `000005`:
  - Dropped redundant `ai_chat_sessions.metadata` and created dedicated `ai_session_metadata` entity (`id UUID PK`, `session_id UUID FK UNIQUE`, `metadata JSONB`)
  - Normalized `analytics_snapshots` by removing duplicate surrogate sequence `id` and establishing `run_id` as primary key
  - Normalized `backup_runs` error data into dedicated `backup_run_errors` table (`id`, `run_id FK UNIQUE`, `error_message`) and dropped nullable `error_message` column from `backup_runs`
  - Normalized `embedding_jobs.error_message` from `NOT NULL DEFAULT 'EMPTY_STRING'` to nullable SQL `NULL` with partial index `WHERE error_message IS NOT NULL`
  - Normalized `embedding_chunks.metadata` to eliminate duplicate relational keys and convert empty `{}` objects to SQL `NULL`
  - Enforced generation lifecycle timestamps (`completed_at` set and `retired_at` cleared to `NULL` on `ACTIVE` generations)
  - Partial indexing on error states across `backup_results`, `backup_run_errors`, `investigations`, `ai_tool_calls`, `embedding_jobs`
  - Partial indexing on commit hashes for `backup_results` and `backup_fixes`
  - Transactional blue-green embedding generation promotion (`BUILDING` -> `READY` -> `ACTIVE` -> `RETIRED`)
  - Safe cascade pruning of obsolete embedding generations and stale jobs without removing source records