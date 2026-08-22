# Real-Time Streaming Architecture (SSE & WebSocket)

This document details the real-time event streaming and telemetry architecture in the **GitHub Backup Automation System**, covering both Server-Sent Events (SSE) in the Python Agentic Observatory and WebSocket multiplexing in the Go Backend.

---

## 1. High-Level Streaming Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                       │
│    (AI Playground & Live WebSocket Telemetry Dashboard)     │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       POST /chat/stream (SSE)        WSS /ws/live (WebSocket)
               │                               │
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│  Python Agent Observatory   │ │        Go Backend API       │
│  (FastAPI StreamingResponse)│ │     (Fiber Hub Poller)      │
└──────────────┬──────────────┘ └──────────────┬──────────────┘
               │                               │
       Async LLM Generator            PostgreSQL execution_logs
               │                               │
               ▼                               ▼
      OpenRouter AI API               Live Log Event Stream
```

---

## 2. Python Agent Observatory (Server-Sent Events / SSE)

### Lifecycle of an SSE Stream
1. **Client Request**: Frontend issues a `POST /chat/stream` request containing prompt, session ID, and optional confirmation payload.
2. **Long-Lived Stream**: FastAPI returns a `StreamingResponse` using `media_type="text/event-stream"`.
3. **Async Generator**: `event_generator()` iterates asynchronously over the agent reasoning loop (`stream_agent()`).
4. **Immediate Chunk Dispatch**: As tokens, tool-calling status updates, or HITL confirmation modals are generated, each is yielded formatted as:
   ```text
   data: {"type": "token", "text": "Analyzing recent backup logs..."}\n\n
   ```
5. **Incremental UI Rendering**: The client reads incoming chunks from the HTTP stream and appends tokens in real time.

### SSE Message Schema
* **Token Output**: `{"type": "token", "text": "<string>"}`
* **Tool Call Started**: `{"type": "tool_start", "name": "<tool_name>", "args": {...}}`
* **Tool Call Completed**: `{"type": "tool_end", "name": "<tool_name>", "duration_ms": 12.4}`
* **Human-In-The-Loop Confirmation**: `{"type": "confirm_required", "confirm_id": "<uuid>", "name": "<tool>", "args": {...}}`
* **Stream End**: `{"type": "done", "session_id": "<uuid>", "latency_s": 1.45}`

---

## 3. Go Backend WebSocket Telemetry

### WebSocket Polling & Hub Architecture
* **Endpoint**: `/ws/live`
* **Protocol**: RFC 6455 WebSocket upgraded via Fiber.
* **Non-Blocking Hub**: `websocket.DefaultHub` polls new `execution_logs` entries and broadcasts structured JSON payloads to all connected clients.
* **Keepalive**: Periodic ping/pong heartbeats to maintain persistent socket connections across proxy load balancers.

---

## 4. Troubleshooting Real-Time Streams

* **Buffering Issues**: Ensure intermediate proxies (Vercel, Render, Cloudflare) have response buffering disabled (`X-Accel-Buffering: no`).
* **Connection Drops**: The frontend automatically reconnects with exponential backoff if the WebSocket or SSE stream disconnects.
