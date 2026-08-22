# Postman Setup Guide

This guide helps you import and use the GitHub Backup API collection and environment in Postman.

## Prerequisites

- **Postman** installed (download from [postman.com](https://www.postman.com/downloads/))
- GitHub Backup **backend service** running on your machine or server
- Default configuration: `http://localhost:8080`

## Quick Start

### 1. Import the Collection

1. Open **Postman**
2. Click on the **Import** button (top-left)
3. Select **Upload Files**
4. Choose `docs/postman/GitHub-Backup-API.postman_collection.json`
5. Click **Import**

The collection will appear in your sidebar with all API endpoints organized by category.

### 2. Import the Environment

1. Click the **Settings** icon (⚙️) in the top-right corner
2. Navigate to **Environments**
3. Click **Import**
4. Select `docs/postman/GitHub-Backup-Environment.postman_environment.json`
5. Close the settings panel

### 3. Select Environment

1. In the top-right corner, find the environment dropdown (currently showing "No environment")
2. Select **"GitHub Backup API - Local Development"**

You're now ready to make API calls!

## Making Your First Request

### Example: Get Latest Backup

1. In the **Backups** folder, click on **"Get Latest Backup"**
2. Click the blue **Send** button
3. You should see the response in the bottom panel

If you get a connection error, verify:
- The backend service is running on port 8080
- Update `base_url` in the environment if running on a different port

## Configuration

### Updating the Environment

To use a different backend URL:

1. Click the environment dropdown in the top-right
2. Select **"GitHub Backup API - Local Development"** → **Edit**
3. Update the values:
   - `base_url`: HTTP API endpoint (e.g., `api.example.com:8080`)
   - `base_url_ws`: WebSocket endpoint (e.g., `api.example.com:8080`)
4. Save the changes

### Creating Environments for Different Deployments

You can create separate environments for development, staging, and production:

1. Click the environment dropdown → **+ Create New**
2. Name it (e.g., "GitHub Backup API - Production")
3. Add variables:
   - `base_url`: Your production API endpoint
   - `base_url_ws`: Your production WebSocket endpoint
4. Save

Now you can easily switch between environments using the dropdown.

## API Endpoints Overview

### Backups
- **List Backup Runs** — Paginated list with filtering
- **Get Latest Backup** — Most recent backup
- **Get Backup Run Details** — Full run data including results

### Dashboard & Metrics
- **Get Dashboard Statistics** — Aggregated metrics and stats
- **Get Metrics** — Time-series data for specified period

### Analytics
- **List Analytics History** — All analytics snapshots
- **Get Latest Analytics** — Most recent snapshot
- **Get Analytics for Specific Run** — Analytics for a run ID

### Repositories
- **Get Tracked Repositories** — List of tracked repos

### Logs
- **Get Execution Logs** — Filtered execution logs

### WebSocket
- **Connect to Live Stream** — Real-time log and status updates

## Advanced Usage

### Scripting Tests

Each request includes built-in test scripts that validate the response. To view:

1. Open any request
2. Click the **Tests** tab
3. The tests check for:
   - Correct HTTP status codes
   - Required response fields
   - Data structure integrity

Run all tests in a collection:

1. Click the **→** (Run) button next to the collection name
2. Click **Run GitHub Backup API**
3. The test runner shows results for all requests

### Using Variables

You can create custom variables for common values:

1. Open the environment editor
2. Add a new variable (e.g., `run_id: "1"`)
3. In requests, reference it with `{{run_id}}`

Example:
```
GET /api/backups/{{run_id}}
```

### Building a Workflow

Chain multiple requests using pre-request and test scripts:

**Example: Get latest backup, then fetch its details**

1. In the "Get Latest Backup" test script, add:
```javascript
pm.environment.set("latest_run_id", pm.response.json().id);
```

2. In the "Get Backup Run Details" URL, use:
```
{{base_url}}/api/backups/{{latest_run_id}}
```

## WebSocket Connections

### Using WebSocket in Postman

Postman supports WebSocket connections natively:

1. Go to **WebSocket** → **Connect to Live Stream**
2. Click **Connect**
3. The console displays incoming messages in real-time
4. Messages include:
   - Worker status updates
   - Live log entries
   - Job progress

### Monitoring Live Logs

Once connected, you'll receive messages like:

```json
{
  "type": "status",
  "data": {
    "current_repo": "octocat/Hello-World",
    "current_run_id": 42,
    "started_at": "2024-06-17T10:30:00Z"
  }
}
```

## Troubleshooting

### "Unable to connect" Error

**Solution:** Verify the backend is running:
```bash
# In the backend directory
go run main.go
```

Check the configured port matches your environment's `base_url`.

### "Rate limit exceeded" (429 Response)

The API enforces rate limiting. If you receive 429 errors:
- Wait before retrying
- Reduce request frequency
- Implement exponential backoff

### WebSocket connection fails

- Ensure `base_url_ws` matches the backend's WebSocket endpoint
- Use `ws://` (not `http://`) in the environment
- Verify the backend accepts WebSocket upgrades on that port

### Missing Response Data

If responses are incomplete:
- Verify your PostgreSQL connection in the backend
- Check backend logs for database errors
- Ensure migrations have run successfully

## API Response Examples

### Successful Backup Run
```json
{
  "id": 42,
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

### Dashboard Statistics
```json
{
  "total_runs": 150,
  "total_repos": 1250,
  "success_rate": 0.944,
  "avg_duration_ms": 900000,
  "total_size_bytes": 536870912
}
```

## Documentation

For detailed API documentation, see:
- [API_REFERENCE.md](./API_REFERENCE.md) — Full endpoint documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture overview
- [../README.md](../README.md) — Project overview

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review [API_REFERENCE.md](./API_REFERENCE.md) for endpoint details
3. Check backend logs for errors

## Tips

✅ **Use Collections** to organize related requests
✅ **Save Responses** for reference and testing
✅ **Use Variables** to avoid hardcoding values
✅ **Write Tests** to validate responses
✅ **Use Environments** to switch between deployments
✅ **Monitor Live Logs** using WebSocket for real-time insights
