---
name: saas-and-mcp-architecture
description: >-
  Architectural patterns and implementation guidelines for the SaaS Connector Hub,
  pluggable multi-cloud storage engines, and Model Context Protocol (MCP) tool expansion.
---

# SaaS Connector & Autonomous MCP Architecture Skill

This skill guides AI agents in implementing and extending the enterprise SaaS capabilities of the **GitHub Backup Automation System**, including UI connectors, encrypted secret vaults, multi-cloud storage backends, and Model Context Protocol (MCP) server integrations.

---

## 1. UI Connector Hub & Encrypted Credential Vault

When implementing or modifying connectors:

* **Zero `.env` for Users**: User-provided API keys and connections MUST be stored in the `connectors` database table with AES-256-GCM envelope encryption.
* **OpenRouter Pool**: Support multiple OpenRouter API keys with in-memory round-robin rotation, latency tracking, and automatic failover.
* **Database Connectors**: Provide connection validation and branch selection for Neon, Supabase, and self-hosted PostgreSQL.
* **Health Checks**: Connectors must implement a periodic health check loop (`last_health_check`, `health_status`).

---

## 2. Pluggable Multi-Cloud Storage Engine

When extending backup archiving and storage destinations:

* All storage drivers must implement the Go `StorageProvider` interface:
  ```go
  type StorageProvider interface {
      Upload(ctx context.Context, key string, r io.Reader, size int64) error
      Download(ctx context.Context, key string, w io.Writer) error
      VerifyChecksum(ctx context.Context, key string, expectedSHA256 string) (bool, error)
      Delete(ctx context.Context, key string) error
      List(ctx context.Context, prefix string) ([]ObjectMetadata, error)
  }
  ```
* Providers to support: AWS S3, Cloudflare R2, MinIO, Google Drive (OAuth), Azure Blob, Local Filesystem.
* Streaming uploads should stream directly from memory / pipe to the cloud without requiring massive local disk scratch space.

---

## 3. Model Context Protocol (MCP) Server Integration

When adding new MCP tools to the LangChain / FastAPI agent:

1. **Protocol Adherence**: Connect via standard MCP JSON-RPC protocol over Stdio or SSE.
2. **Human-In-The-Loop (HITL) Enforcement**:
   - Read-only tools (`query_database_state`, `list_backups`, `inspect_container`) execute automatically.
   - Destructive or external actions (`restart_service`, `restore_database_snapshot`, `trigger_incident_alert`, `apply_schema_migration`) MUST trigger the HITL confirmation protocol via SSE event.
3. **Structured Response Synthesis**:
   - All MCP tool outputs must be synthesized concisely in structured Markdown without emojis or conversational filler.

---

## 4. Exposing the Native GitHub Backup MCP Server (`github-backup-mcp`)

When maintaining or extending the native MCP server exposed to external IDEs/agents:

* Implement tools under `github-backup-mcp`:
  - `get_system_health`: Real-time status of services, DB, and latest runs.
  - `trigger_backup_run`: Autonomous run triggers for specified repos.
  - `search_observatory_knowledge`: Hybrid pgvector search across system logs.
  - `verify_archive_integrity`: SHA-256 validation of `.tar.gz` archives.
  - `extract_backup_file`: Surgical extraction from remote S3/R2 backups.
* Expose over both standard stdio transport and HTTP/SSE transport for web-based agents.

