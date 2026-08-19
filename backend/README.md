# Backup Observatory - Backend

The backend is a Go-based web server that provides the REST API and WebSocket connections for the Frontend Dashboard. It connects to a PostgreSQL database to store and serve backup run history, metrics, and streams real-time logs from the Worker CLI.

## Tech Stack

- **Language**: Go
- **Database**: PostgreSQL
- **WebSockets**: Native Go implementations for live log streaming

## Getting Started

### Prerequisites

- Go toolchain installed (1.20+)
- PostgreSQL server running locally or remotely

### Configuration

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Required: PostgreSQL connection string (Secret)
DATABASE_URL=postgres://user:password@localhost:5432/dbname?sslmode=disable

# Optional: Shared secret for internal API protection
INTERNAL_SECRET=generate_a_random_32_plus_char_secret_here
```

*Note: Ensure the database specified in `DATABASE_URL` exists. The backend automatically applies migrations non-destructively on startup.*

### Running the Server

Navigate to the `backend` directory and start the server:

```bash
cd backend
go run main.go
```

The server will start listening on the configured `SERVER_PORT` (default `8080`).

## Folder Structure

- `main.go`: Entry point for the backend server.
- `db/`: PostgreSQL connection setup and automatic schema migrations.
- `handlers/`: HTTP and WebSocket request handlers containing the core business logic.
- `middleware/`: HTTP middleware (e.g., CORS, logging, authentication if applicable).
- `models/`: Data structures representing API requests, responses, and DB records.
- `routes/`: API endpoint definitions mapping URLs to handlers.
- `websocket/`: Logic for managing WebSocket client connections and broadcasting logs.
