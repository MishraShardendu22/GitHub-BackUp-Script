# API Reference

This document describes the HTTP API exposed by the backup dashboard backend server. All API endpoints are mounted under `/api` unless otherwise stated. The API is built with [Fiber](https://gofiber.io/) and uses PostgreSQL as the persistence layer.

**Base URL:** `http://localhost:8080` (or configured `SERVER_PORT`)

**Rate Limiting:** All `/api` routes are rate-limited. Requests exceeding the limit will receive a 429 (Too Many Requests) response.

---

## Table of Contents
1. [Backups](#backups)
2. [Dashboard & Metrics](#dashboard--metrics)
3. [Analytics](#analytics)
4. [Repositories](#repositories)
5. [Logs](#logs)
6. [WebSocket](#websocket)
7. [Error Handling](#error-handling)
8. [Data Models](#data-models)

---

## Backups

### List Backup Runs
**Endpoint:** `GET /api/backups`

Retrieve a paginated list of backup runs in reverse chronological order (newest first).

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | — | Page number (1-indexed) |
| `limit` | integer | 50 | 500 | Results per page |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "started_at": "2024-06-17T10:30:00Z",
      "completed_at": "2024-06-17T10:45:30Z",
      "status": "success",
      "duration_ms": 870000,
      "total_repos": 45,
      "successful": 42,
      "failed": 2,
      "skipped": 1,
      "error_message": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total_items": 150,
    "total_pages": 3
  }
}
```

**Status Values:** `success`, `failed`, `running`, `cancelled`

---

### Get Latest Backup
**Endpoint:** `GET /api/backups/latest`

Retrieve the most recent backup run without pagination.

**Response:** `200 OK`
```json
{
  "id": 150,
  "started_at": "2024-06-17T10:30:00Z",
  "completed_at": "2024-06-17T10:45:30Z",
  "status": "success",
  "duration_ms": 870000,
  "total_repos": 45,
  "successful": 42,
  "failed": 2,
  "skipped": 1,
  "error_message": null
}
```

---

### Get Backup Run Details
**Endpoint:** `GET /api/backups/:id`

Retrieve detailed information for a specific backup run, including all repository backup results.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Backup run ID |

**Response:** `200 OK`
```json
{
  "run": {
    "id": 1,
    "started_at": "2024-06-17T10:30:00Z",
    "completed_at": "2024-06-17T10:45:30Z",
    "status": "success",
    "duration_ms": 870000,
    "total_repos": 45,
    "successful": 42,
    "failed": 2,
    "skipped": 1,
    "error_message": null
  },
  "backup_results": [
    {
      "id": 1,
      "run_id": 1,
      "repo_full_name": "octocat/Hello-World",
      "status": "success",
      "created_at": "2024-06-17T10:30:15Z",
      "duration_ms": 5000,
      "commit_hash": "abc123def456",
      "archive_size_bytes": 1048576,
      "error_message": null
    },
    {
      "id": 2,
      "run_id": 1,
      "repo_full_name": "octocat/Spoon-Knife",
      "status": "failed",
      "created_at": "2024-06-17T10:32:10Z",
      "duration_ms": 3000,
      "commit_hash": null,
      "archive_size_bytes": 0,
      "error_message": "Network timeout during clone"
    }
  ]
}
```

---

## Dashboard & Metrics

### Get Dashboard Statistics
**Endpoint:** `GET /api/dashboard/stats`

Retrieve aggregated statistics for the dashboard overview, including totals, success rates, and latest analytics.

**Timeout:** 15 seconds (operations are cancelled if exceeded)

**Response:** `200 OK`
```json
{
  "total_runs": 150,
  "total_repos": 1250,
  "total_successful": 1180,
  "total_failed": 45,
  "total_skipped": 25,
  "distinct_repos": 320,
  "total_logs": 5420,
  "success_rate": 0.944,
  "last_run_status": "success",
  "last_run_at": "2024-06-17T10:45:30Z",
  "avg_duration_ms": 900000,
  "total_size_bytes": 536870912,
  "largest_archive_bytes": 104857600,
  "largest_repository": "octocat/large-repo",
  "latest_analytics": {
    "id": 1,
    "run_id": 150,
    "captured_at": "2024-06-17T10:45:30Z",
    "head_commit": "abc123def456789",
    "head_commit_message": "Merge pull request #1",
    "head_commit_at": "2024-06-17T10:40:00Z",
    "total_commits": 5420,
    "branch_count": 12,
    "tag_count": 3,
    "tracked_files": 850,
    "total_blob_size_bytes": 536870912,
    "avg_blob_size_bytes": 631680,
    "largest_blob_path": "data/archive.tar.gz",
    "largest_blob_size_bytes": 104857600,
    "archive_count": 320,
    "total_archive_size_bytes": 536870912,
    "avg_archive_size_bytes": 1677721,
    "largest_archive_path": "archives/large-repo.tar.gz",
    "largest_archive_size_bytes": 104857600
  }
}
```

---

### Get Metrics
**Endpoint:** `GET /api/metrics`

Retrieve time-series metrics and performance trends for the specified period.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer | 30 | Number of days to look back |
| `page` | integer | 1 | Page number for results |
| `limit` | integer | 50 | Results per page |

**Response:** `200 OK`
```json
{
  "data": {
    "period_days": 30,
    "average_run_duration_ms": 900000,
    "total_runs_in_period": 30,
    "aggregated_success_rate": 0.944,
    "run_history": [
      {
        "date": "2024-05-18",
        "run_count": 1,
        "successful": 42,
        "failed": 2,
        "skipped": 1,
        "avg_duration_ms": 870000,
        "total_size_bytes": 536870912
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total_items": 30,
    "total_pages": 1
  }
}
```

---

## Analytics

### List Analytics History
**Endpoint:** `GET /api/analytics/history`

Retrieve all repository analytics snapshots in reverse chronological order.

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | — | Page number |
| `limit` | integer | 50 | 500 | Results per page |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "run_id": 150,
      "captured_at": "2024-06-17T10:45:30Z",
      "head_commit": "abc123def456789",
      "head_commit_message": "Merge pull request #1",
      "head_commit_at": "2024-06-17T10:40:00Z",
      "total_commits": 5420,
      "branch_count": 12,
      "tag_count": 3,
      "tracked_files": 850,
      "total_blob_size_bytes": 536870912,
      "avg_blob_size_bytes": 631680,
      "largest_blob_path": "data/archive.tar.gz",
      "largest_blob_size_bytes": 104857600,
      "archive_count": 320,
      "total_archive_size_bytes": 536870912,
      "avg_archive_size_bytes": 1677721,
      "largest_archive_path": "archives/large-repo.tar.gz",
      "largest_archive_size_bytes": 104857600
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total_items": 150,
    "total_pages": 3
  }
}
```

---

### Get Latest Analytics
**Endpoint:** `GET /api/analytics/latest`

Retrieve the most recent analytics snapshot without pagination.

**Response:** `200 OK`
```json
{
  "id": 1,
  "run_id": 150,
  "captured_at": "2024-06-17T10:45:30Z",
  "head_commit": "abc123def456789",
  "head_commit_message": "Merge pull request #1",
  "head_commit_at": "2024-06-17T10:40:00Z",
  "total_commits": 5420,
  "branch_count": 12,
  "tag_count": 3,
  "tracked_files": 850,
  "total_blob_size_bytes": 536870912,
  "avg_blob_size_bytes": 631680,
  "largest_blob_path": "data/archive.tar.gz",
  "largest_blob_size_bytes": 104857600,
  "archive_count": 320,
  "total_archive_size_bytes": 536870912,
  "avg_archive_size_bytes": 1677721,
  "largest_archive_path": "archives/large-repo.tar.gz",
  "largest_archive_size_bytes": 104857600
}
```

---

### Get Analytics for Specific Run
**Endpoint:** `GET /api/analytics/:id`

Retrieve the analytics snapshot for a specific backup run ID.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Backup run ID |

**Response:** `200 OK` — Same structure as [Get Latest Analytics](#get-latest-analytics)

---

## Repositories

### Get Tracked Repositories
**Endpoint:** `GET /api/repos`

Retrieve the list of currently tracked repositories from the dashboard perspective.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Results per page |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "full_name": "octocat/Hello-World",
      "url": "https://github.com/octocat/Hello-World",
      "is_private": false,
      "description": "Example repository",
      "last_backed_up": "2024-06-17T10:45:30Z",
      "archive_size_bytes": 1048576
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total_items": 320,
    "total_pages": 7
  }
}
```

---

## Logs

### Get Execution Logs
**Endpoint:** `GET /api/logs`

Retrieve stored execution logs for display in the UI.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 100 | Results per page |
| `level` | string | — | Filter by log level (INFO, WARN, ERROR, DEBUG) |
| `run_id` | integer | — | Filter by specific backup run ID |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "created_at": "2024-06-17T10:30:15Z",
      "level": "INFO",
      "message": "Starting backup run",
      "repository": null,
      "run_id": 1
    },
    {
      "id": 2,
      "created_at": "2024-06-17T10:30:20Z",
      "level": "INFO",
      "message": "Cloning repository",
      "repository": "octocat/Hello-World",
      "run_id": 1
    },
    {
      "id": 3,
      "created_at": "2024-06-17T10:32:10Z",
      "level": "ERROR",
      "message": "Network timeout during clone",
      "repository": "octocat/Spoon-Knife",
      "run_id": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total_items": 5420,
    "total_pages": 55
  }
}
```

---

## WebSocket

### Real-time Live Logs
**Endpoint:** `GET /ws/live`

WebSocket endpoint for streaming real-time worker status and execution logs. Upgrade to WebSocket protocol using the `Upgrade` header.

**Connection Example:**
```javascript
const ws = new WebSocket('ws://localhost:8080/ws/live');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type: 'status' or 'log'
  console.log(data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Connection closed');
};
```

**Message Types:**

**Status Update:**
```json
{
  "type": "status",
  "data": {
    "current_repo": "octocat/Hello-World",
    "current_run_id": 1,
    "started_at": "2024-06-17T10:30:00Z",
    "status": "running"
  }
}
```

**Log Entry:**
```json
{
  "type": "log",
  "data": {
    "level": "INFO",
    "message": "Cloning repository",
    "repository": "octocat/Hello-World",
    "timestamp": "2024-06-17T10:30:20Z"
  }
}
```

---

## Error Handling

The API returns standard HTTP status codes and error responses:

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad Request (invalid query parameters, etc.) |
| 404 | Not Found (requested resource doesn't exist) |
| 429 | Too Many Requests (rate limit exceeded) |
| 500 | Internal Server Error |
| 503 | Service Unavailable (database connection issue) |

**Error Response Format:**
```json
{
  "error": "error message describing what went wrong"
}
```

**Example:**
```json
{
  "error": "invalid page number: page must be >= 1"
}
```

---

## Data Models

### BackupRun
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `started_at` | ISO 8601 timestamp | When the run started |
| `completed_at` | ISO 8601 timestamp or null | When the run completed |
| `status` | string | One of: `success`, `failed`, `running`, `cancelled` |
| `duration_ms` | integer | Total duration in milliseconds |
| `total_repos` | integer | Total repositories in the run |
| `successful` | integer | Successfully backed up repos |
| `failed` | integer | Failed backups |
| `skipped` | integer | Skipped repos (no changes detected) |
| `error_message` | string or null | Error details if status is `failed` |

### BackupResult
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `run_id` | integer | Associated backup run ID |
| `repo_full_name` | string | Repository full name (owner/repo) |
| `status` | string | One of: `success`, `failed`, `skipped` |
| `created_at` | ISO 8601 timestamp | When the result was created |
| `duration_ms` | integer | Time taken to backup this repo |
| `commit_hash` | string or null | Git commit hash of the backup |
| `archive_size_bytes` | integer | Size of the generated archive |
| `error_message` | string or null | Error details if status is `failed` |

### RepoAnalyticsSnapshot
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `run_id` | integer or null | Associated backup run ID |
| `captured_at` | ISO 8601 timestamp | When the snapshot was taken |
| `head_commit` | string | Latest commit hash |
| `head_commit_message` | string | Latest commit message |
| `head_commit_at` | ISO 8601 timestamp or null | When the latest commit was made |
| `total_commits` | integer | Total commits in backup repo |
| `branch_count` | integer | Number of branches |
| `tag_count` | integer | Number of tags |
| `tracked_files` | integer | Total files being tracked |
| `total_blob_size_bytes` | integer | Total blob size |
| `avg_blob_size_bytes` | integer | Average blob size |
| `largest_blob_path` | string | Path to largest blob |
| `largest_blob_size_bytes` | integer | Size of largest blob |
| `archive_count` | integer | Number of archives |
| `total_archive_size_bytes` | integer | Total archive size |
| `avg_archive_size_bytes` | integer | Average archive size |
| `largest_archive_path` | string | Path to largest archive |
| `largest_archive_size_bytes` | integer | Size of largest archive |

### ExecutionLog
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `created_at` | ISO 8601 timestamp | When the log was created |
| `level` | string | Log level: `INFO`, `WARN`, `ERROR`, `DEBUG` |
| `message` | string | Log message |
| `repository` | string or null | Associated repository (if applicable) |
| `run_id` | integer or null | Associated backup run ID |

### DashboardStats
| Field | Type | Description |
|-------|------|-------------|
| `total_runs` | integer | Total number of backup runs |
| `total_repos` | integer | Total repositories processed |
| `total_successful` | integer | Total successful backups |
| `total_failed` | integer | Total failed backups |
| `total_skipped` | integer | Total skipped backups |
| `distinct_repos` | integer | Unique repositories backed up |
| `success_rate` | float | Success percentage (0-1) |
| `last_run_status` | string | Status of the last run |
| `last_run_at` | ISO 8601 timestamp or null | When the last run occurred |
| `avg_duration_ms` | integer | Average run duration |
| `total_size_bytes` | integer | Total backup size |
| `largest_archive_bytes` | integer | Size of largest archive |
| `largest_repository` | string | Name of largest repository backup |
| `latest_analytics` | RepoAnalyticsSnapshot or null | Most recent analytics snapshot |

---

## Implementation Notes

- All responses are JSON-formatted.
- Timestamps are in ISO 8601 format with UTC timezone.
- All sizes are in bytes.
- Durations are in milliseconds.
- The API relies on PostgreSQL for persistence; ensure `DATABASE_URL` is configured and the database is running.
- All `/api` routes are rate-limited. Implement exponential backoff when receiving 429 responses.
- Response handlers are implemented in [backend/handlers/](../backend/handlers/) directory.
- Routes are defined in [backend/routes/app.routes.go](../backend/routes/app.routes.go).
