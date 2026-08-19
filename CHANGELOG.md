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
  - Normalized `ai_session_metadata` key-value store with cascade deletion
  - Partial indexing on error states across `backup_results`, `backup_runs`, `investigations`, `ai_tool_calls`
  - Partial indexing on commit hashes for `backup_results` and `backup_fixes`
  - Normalized `embedding_chunks.metadata` to eliminate duplicate relational keys
  - Transactional blue-green embedding generation promotion (`BUILDING` -> `READY` -> `ACTIVE` -> `RETIRED`)
  - Safe cascade pruning of obsolete embedding generations and stale jobs without removing source records