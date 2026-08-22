# Python Observatory Streaming Guide

This document summarizes the Server-Sent Events (SSE) streaming implementation in the Python Agentic Observatory.

> **Full Architecture Reference**: For complete end-to-end streaming architecture across both SSE and Go WebSockets, see [`docs/STREAMING_ARCHITECTURE.md`](../docs/STREAMING_ARCHITECTURE.md).

---

## 1. Quick Concept

```text
Frontend ---> POST /chat/stream ---> FastAPI (StreamingResponse) ---> stream_agent() ---> LLM Tokens ---> yield "data: ...\n\n"
```

1. **Client opens a long-lived HTTP connection** to `POST /chat/stream`.
2. **FastAPI returns `StreamingResponse(event_generator(), media_type="text/event-stream")`**.
3. **Async Generator yields chunks** formatted as SSE standard `data: <payload>\n\n`.
4. **Frontend renders incrementally** without waiting for the full LLM response to complete.

---

## 2. Core Implementation

```python
@app.post("/chat/stream")
async def chat_stream(req: ChatStreamRequest):
    async def event_generator():
        async for event in stream_agent(req.prompt, req.session_id):
            yield f"data: {event}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```
