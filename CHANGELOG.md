# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Intelligent Git Pre-Commit Hook Workflow (`.githooks/pre-commit`):
  - Automatically inspects staged files and selectively triggers targeted validations across Go Backend/Worker, Python Agentic Observatory, and Next.js Frontend.
  - Multi-tier validation pipeline: code formatting (`gofmt`, Biome), static analysis & type checking (`go vet`, `pyright`, `tsc`), test suites, and production artifact builds.
  - Fail-fast execution with timing diagnostics, colorized logging, and remediation advice.
  - Documentation-only fast-path bypassing heavy builds on non-code changes.
  - Developer automation targets in `Makefile`: `make hooks-install`, `make pre-commit`, `make format`, `make typecheck`.
  - Comprehensive documentation in `docs/PRECOMMIT_WORKFLOW.md`.
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
  - Normalized `backup_results` error data into dedicated `backup_result_errors` table (`id`, `result_id FK UNIQUE`, `error_message`) and dropped nullable `error_message` column from `backup_results`
  - Normalized `backup_fixes` by extracting optional commit hashes into dedicated `backup_fix_commits` table (`id`, `fix_id FK UNIQUE`, `commit_hash`) and dropping `commit_hash` from `backup_fixes`
  - Normalized `ai_tool_calls` by extracting non-empty parameters and failures into dedicated `ai_tool_call_args` and `ai_tool_call_errors` tables, dropping nullable `args` and `error` columns from `ai_tool_calls`
  - Normalized `embedding_chunks` metadata into dedicated `embedding_chunk_metadata` table (`id`, `chunk_id FK UNIQUE`, `metadata JSONB`) and dropped `metadata` column from `embedding_chunks`
  - Normalized `embedding_jobs` error data into dedicated `embedding_job_errors` table (`id`, `job_id FK UNIQUE`, `error_message`) and dropped nullable `error_message` column from `embedding_jobs`
  - Normalized `investigations` error data into dedicated `investigation_errors` table (`id`, `investigation_id FK UNIQUE`, `error`) and dropped nullable `error` column from `investigations`
  - Enforced generation lifecycle timestamps (`completed_at` set and `retired_at` cleared to `NULL` on `ACTIVE` generations)
  - Partial indexing on failure states across `backup_results`, `backup_run_errors`, `backup_result_errors`, `embedding_job_errors`, `investigation_errors`, `ai_tool_calls`
  - Partial indexing on commit hashes for `backup_results` and `backup_fix_commits`
  - Transactional blue-green embedding generation promotion (`BUILDING` -> `READY` -> `ACTIVE` -> `RETIRED`)
  - Safe cascade pruning of obsolete embedding generations and stale jobs without removing source records