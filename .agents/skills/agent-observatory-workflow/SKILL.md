---
name: agent-observatory-workflow
description: >-
  Step-by-step instructions for extending the Python AI Observatory agent: adding LangChain tools,
  Tool-Calling RAG workflows, enforcing Human-in-the-Loop approvals, multi-key OpenRouter failover, and pgvector embeddings.
---

# Agent Observatory Workflow & Extension Guide

This skill guides agents and engineers on how to safely build, modify, test, and enhance AI agent features within `agentic-observatory/`.

---

## 1. Adding a New Agent Tool

1. Create or update a tool file under [`agentic-observatory/data/tools/`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/agentic-observatory/data/tools/):
   ```python
   from typing import Annotated, Any
   from langchain_core.tools import tool

   @tool
   async def inspect_custom_metric(
       metric_name: Annotated[str, "The name of the metric to query"],
       days: Annotated[int, "Number of lookback days"] = 7,
   ) -> dict[str, Any]:
       """Query custom operational metrics from the database."""
       # Perform database query or API call
       return {"metric": metric_name, "value": 42}
   ```
2. Export the tool in [`agentic-observatory/data/tools/__init__.py`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/agentic-observatory/data/tools/__init__.py).
3. Add the tool to the `TOOLS` list in [`agentic-observatory/agent/openrouter.py`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/agentic-observatory/agent/openrouter.py).

---

## 2. Tool-Calling RAG & Vector Knowledge Base

The AI Observatory operates as a **Tool-Calling RAG Agent**:
1. **Pre-turn Retrieval**: Injects top relevance chunks into system context before iteration 1.
2. **Dynamic Tool Calling**: The agent calls `hybrid_search_knowledge_base` during reasoning loops for deep evidence gathering:
   ```python
   # Inside agent/openrouter.py:
   from data.tools import hybrid_search_knowledge_base
   ```
   * Supported source filters: `['chat_message', 'execution_log', 'investigation', 'backup_result', 'backup_fix']`.
   * Combines Full-Text Search (tsvector), pgvector cosine similarity, and Reciprocal Rank Fusion (RRF).

---

## 3. Implementing Human-In-The-Loop (HITL) Actions

For sensitive actions (e.g., sending emails, applying hotfixes, modifying DB records):
1. In `agentic-observatory/agent/openrouter.py`, intercept the tool before execution:
   ```python
   if tool_name == "send_report_email":
       confirm_id = str(uuid.uuid4())
       confirm_event = asyncio.Event()
       active_confirmations[confirm_id] = confirm_event

       yield json.dumps({
           "type": "confirm_required",
           "confirm_id": confirm_id,
           "name": tool_name,
           "args": tool_args,
       })
       # Wait up to 120s for user response via /chat/confirm
       await asyncio.wait_for(confirm_event.wait(), timeout=120.0)
   ```
2. Feed the user approval or rejection back to the LLM context.

---

## 4. Working with Multi-Key OpenRouter Failover

Always use [`agentic-observatory/utils/openrouter_keys.py`](file:///home/ms22/Coding_stuff/Personal-Projects/github-backup-automation-system/agentic-observatory/utils/openrouter_keys.py):
* `get_openrouter_api_keys()`: Returns all configured keys.
* `get_active_openrouter_key()`: Returns the currently active working key.
* `rotate_openrouter_key(failed_key, reason)`: Advances to the next backup key when an error (`401`, `402`, `429`) occurs.

---

## 5. Comprehensive Agent Test Suites

Run the test suite commands:
```bash
# 1. Run all unit and integration tests across the system
make test

# 2. Run dedicated AI Agent & Tool-Calling RAG test suite
make test-agents

# 3. Direct execution of Agent tests
cd agentic-observatory && uv run python test_agent_suite.py
```
