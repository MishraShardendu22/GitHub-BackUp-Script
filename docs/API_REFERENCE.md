# API Reference

This file describes the HTTP API exposed by the backend server (see [backend/routes/router.go](backend/routes/router.go#L1)). All API endpoints are mounted under `/api` unless otherwise stated.

Backups
- `GET /api/backups` — List backup runs. Query params: `limit` (default 20), `offset` (default 0). Returns an array of `BackupRun` objects.
- `GET /api/backups/latest` — Returns the most-recent backup run.
- `GET /api/backups/:id` — Returns details and `backup_results` for a specific run ID.

Dashboard / Metrics
- `GET /api/dashboard/stats` — Aggregated statistics for dashboard tiles: total runs, total repos, success rate, last run status, total size, largest archive, and latest analytics snapshot.
- `GET /api/metrics` — Time-series metrics and trends (used by the Metrics page).

Logs
- `GET /api/logs` — Returns stored execution logs for display.

Repos
- `GET /api/repos` — Returns the currently tracked repositories (from the dashboard perspective).

AI
- `POST /api/ai/chat` — Send AI assistant chat requests (the frontend uses this to summarize runs and produce assessments).
- `GET /api/ai/conversations` — List stored AI conversations.
- `GET /api/ai/conversations/:id` — Get a single conversation.
- `DELETE /api/ai/conversations/:id` — Delete a conversation.

Reports
- `GET /api/reports/latest` — Fetch the latest generated report.
- `POST /api/reports/latest` — Regenerate or request the latest report.
- `POST /api/reports/send` — Send a report by email (SMTP must be configured).
- `GET /api/reports/history` — List previously sent reports.

System
- `GET /api/system/health` — Basic health check endpoint.
- `GET /api/system/live` — Returns live worker status (progress, current repo, run id).

WebSocket
- `GET /ws/live` — WebSocket endpoint for real-time log/worker events.

Notes
- Responses are implemented in `backend/handlers/*`. See handler files for exact field names and structures.
- The API relies on PostgreSQL for persisted runs and analytics; ensure `POSTGRES_URL` is configured before starting the backend.
