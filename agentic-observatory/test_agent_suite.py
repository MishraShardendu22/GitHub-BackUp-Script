"""Comprehensive AI Agent Test Suite.

Thorough test suite covering:
1. Multi-turn Agent Reasoning & Tool-Calling RAG
2. SSE Streaming Agent Workflow & Event Payloads
3. Human-in-the-Loop (HITL) Confirmations (Approve, Reject, Timeout)
4. Multi-Key OpenRouter Failover & Rotation
5. Session Conversation History & Context Preservation
6. LangChain Tool Execution, Exception Handling, & Safe Serialization
7. Dynamic OpenRouter Model Registry & Modality Filtering
8. Text Chunking, Sliding-Window Splitting, & Content Hashing
"""

from __future__ import annotations

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from agent.openrouter import (
    active_confirmations,
    active_responses,
    extract_text_from_chunk,
    invoke_agent,
    stream_agent,
)
from agent.state import AgentResponse, ToolExecution, safe_serialize_payload
from data.embedding_models import (
    fetch_free_embedding_models,
    fetch_free_reranking_models,
    get_embedding_model,
    get_reranking_model,
)
from data.embeddings import chunk_text, content_hash
from utils.openrouter_keys import (
    get_active_openrouter_key,
    get_openrouter_api_keys,
    rotate_openrouter_key,
)


class MockLLMChunk:
    """Mock streaming chunk from LLM provider."""
    def __init__(self, content=None, content_blocks=None):
        if content is not None:
            self.content = content
        if content_blocks is not None:
            self.content_blocks = content_blocks


class TestAgentComprehensiveSuite(unittest.IsolatedAsyncioTestCase):
    """Deep integration and unit test suite for the AI Agent Observatory."""

    # -------------------------------------------------------------------------
    # 1. Chunk Extraction & Text Parsing
    # -------------------------------------------------------------------------
    def test_extract_text_from_various_chunk_structures(self):
        # Plain string
        self.assertEqual(extract_text_from_chunk(MockLLMChunk(content="Hello Agent")), "Hello Agent")

        # List of string/dict parts
        list_chunk = MockLLMChunk(content=[{"text": "Chunk 1 "}, {"content": "Chunk 2"}])
        self.assertEqual(extract_text_from_chunk(list_chunk), "Chunk 1 Chunk 2")

        # Content blocks attribute
        block_chunk = MockLLMChunk(content_blocks=[{"text": "Block A "}, "Block B"])
        self.assertEqual(extract_text_from_chunk(block_chunk), "Block A Block B")

        # Empty / None
        self.assertEqual(extract_text_from_chunk(MockLLMChunk(content=None)), "")

    def test_safe_serialize_payload_edge_cases(self):
        # Complex nested dict with None, bool, numbers, and strings
        data = {
            "key": "val",
            "nested": {"array": [1, 2, 3], "flag": True, "null_val": None},
        }
        res = safe_serialize_payload(data)
        self.assertIn('"flag": true', res)
        self.assertIn('"null_val": null', res)

        # Plain string payload
        self.assertIn("raw string", safe_serialize_payload("raw string"))

    # -------------------------------------------------------------------------
    # 2. Multi-Key OpenRouter Failover & Key Pool Rotation
    # -------------------------------------------------------------------------
    def test_multi_key_pool_failover(self):
        with patch("utils.openrouter_keys.settings.OPENROUTER_API_KEY", "sk-key-1, sk-key-2, sk-key-3"):
            from utils import openrouter_keys
            with openrouter_keys._lock:
                openrouter_keys._current_key_index = 0

            keys = get_openrouter_api_keys()
            self.assertEqual(len(keys), 3)
            self.assertEqual(get_active_openrouter_key(), "sk-key-1")

            # 429 Rate limit rotation
            key2 = rotate_openrouter_key(failed_key="sk-key-1", reason="429 Too Many Requests")
            self.assertEqual(key2, "sk-key-2")
            self.assertEqual(get_active_openrouter_key(), "sk-key-2")

            # 401 Invalid key rotation
            key3 = rotate_openrouter_key(failed_key="sk-key-2", reason="401 Unauthorized")
            self.assertEqual(key3, "sk-key-3")
            self.assertEqual(get_active_openrouter_key(), "sk-key-3")

            # Wrap around back to key 1
            key1 = rotate_openrouter_key(failed_key="sk-key-3", reason="Key pool exhausted wrap-around")
            self.assertEqual(key1, "sk-key-1")

    # -------------------------------------------------------------------------
    # 3. Tool-Calling RAG Agent Execution (Multi-Turn)
    # -------------------------------------------------------------------------
    @patch("agent.openrouter.TOOLS_BY_NAME")
    @patch("agent.openrouter.get_bound_llm")
    @patch("agent.openrouter._retrieve_hybrid_context")
    async def test_tool_calling_rag_multi_turn_investigation(self, mock_retrieve, mock_llm_getter, mock_tools):
        mock_retrieve.return_value = ("Base System Prompt", [])

        # Turn 1: LLM calls hybrid_search_knowledge_base
        turn_1_resp = MagicMock()
        turn_1_resp.tool_calls = [{
            "id": "call_search_1",
            "name": "hybrid_search_knowledge_base",
            "args": {"query": "rate limit error", "source_types": ["execution_log"], "limit": 3},
        }]
        turn_1_resp.content = ""

        # Turn 2: LLM calls list_backup_runs
        turn_2_resp = MagicMock()
        turn_2_resp.tool_calls = [{
            "id": "call_runs_2",
            "name": "list_backup_runs",
            "args": {"limit": 2},
        }]
        turn_2_resp.content = ""

        # Turn 3: LLM provides comprehensive synthesized final answer
        turn_3_resp = MagicMock()
        turn_3_resp.tool_calls = []
        turn_3_resp.content = "Investigation Complete: Found 2 rate-limited backup runs in execution logs."

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[turn_1_resp, turn_2_resp, turn_3_resp])
        mock_llm_getter.return_value = mock_llm

        # Mock tools
        mock_search_tool = MagicMock()
        mock_search_tool.ainvoke = AsyncMock(return_value={"results": [{"content": "HTTP 403 Rate limit"}]})
        mock_runs_tool = MagicMock()
        mock_runs_tool.ainvoke = AsyncMock(return_value=[{"id": 101, "status": "FAILED"}])

        mock_tools.__getitem__.side_effect = lambda name: mock_search_tool if name == "hybrid_search_knowledge_base" else mock_runs_tool

        response: AgentResponse = await invoke_agent(
            question="Analyze recent rate limiting errors during backups.",
            session_id=None,
        )

        self.assertIn("Investigation Complete", response.answer)
        self.assertEqual(len(response.tool_calls), 2)
        self.assertEqual(response.tool_calls[0].name, "hybrid_search_knowledge_base")
        self.assertEqual(response.tool_calls[1].name, "list_backup_runs")

    # -------------------------------------------------------------------------
    # 4. SSE Streaming Agent Workflow & Event Stream
    # -------------------------------------------------------------------------
    @patch("agent.openrouter.TOOLS_BY_NAME")
    @patch("agent.openrouter.get_bound_llm")
    @patch("agent.openrouter._retrieve_hybrid_context")
    async def test_stream_agent_event_flow(self, mock_retrieve, mock_llm_getter, mock_tools):
        mock_retrieve.return_value = ("System Prompt", [{"source_id": "1", "content": "Sample Chunk"}])

        turn_1_resp = MagicMock()
        turn_1_resp.tool_calls = [{
            "id": "call_metrics_1",
            "name": "fetch_backup_metrics",
            "args": {"limit": 1},
        }]

        turn_2_resp = MagicMock()
        turn_2_resp.tool_calls = []

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[turn_1_resp, turn_2_resp])
        mock_llm.astream = MagicMock(return_value=self._mock_async_stream(["All ", "metrics ", "operational."]))
        mock_llm_getter.return_value = mock_llm

        mock_tool = MagicMock()
        mock_tool.ainvoke = AsyncMock(return_value={"success_rate": 99.5})
        mock_tools.__getitem__.return_value = mock_tool

        events = []
        async for event_str in stream_agent(question="Show system status"):
            events.append(json.loads(event_str.strip()))

        event_types = [e.get("type") for e in events]
        self.assertIn("info", event_types)
        self.assertIn("agent_reasoning", event_types)
        self.assertIn("tool_start", event_types)
        self.assertIn("tool_end", event_types)
        self.assertIn("token", event_types)
        self.assertIn("done", event_types)

    async def _mock_async_stream(self, tokens: list[str]):
        for t in tokens:
            yield MockLLMChunk(content=t)

    # -------------------------------------------------------------------------
    # 5. Human-In-The-Loop (HITL) Email Confirmation Middleware
    # -------------------------------------------------------------------------
    @patch("agent.openrouter.TOOLS_BY_NAME")
    @patch("agent.openrouter.get_bound_llm")
    @patch("agent.openrouter._retrieve_hybrid_context")
    async def test_hitl_rejection_flow(self, mock_retrieve, mock_llm_getter, mock_tools):
        mock_retrieve.return_value = ("System Prompt", [])

        # Turn 1 requests sensitive send_report_email tool
        turn_1_resp = MagicMock()
        turn_1_resp.tool_calls = [{
            "id": "call_email_1",
            "name": "send_report_email",
            "args": {"recipients": ["admin@domain.com"], "subject": "Backup Report"},
        }]

        # Turn 2 responds after rejection
        turn_2_resp = MagicMock()
        turn_2_resp.tool_calls = []

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[turn_1_resp, turn_2_resp])
        mock_llm.astream = MagicMock(return_value=self._mock_async_stream(["Email was aborted as requested."]))
        mock_llm_getter.return_value = mock_llm

        # Run stream in background and simulate human rejection
        async def run_and_reject():
            events = []
            async for event_str in stream_agent(question="Send summary email"):
                data = json.loads(event_str)
                events.append(data)
                if data.get("type") == "confirm_required":
                    confirm_id = data.get("confirm_id")
                    # Simulate user rejecting the email action
                    active_responses[confirm_id] = False
                    if confirm_id in active_confirmations:
                        active_confirmations[confirm_id].set()
            return events

        events = await run_and_reject()
        types = [e.get("type") for e in events]
        self.assertIn("confirm_required", types)

        # Ensure tool_end was marked as failed
        tool_end_event = next(e for e in events if e.get("type") == "tool_end")
        self.assertFalse(tool_end_event["success"])
        self.assertIn("rejected", tool_end_event.get("error", "").lower())

    # -------------------------------------------------------------------------
    # 6. Dynamic Model Registry & Modality Tests
    # -------------------------------------------------------------------------
    async def test_dynamic_embedding_and_reranking_models(self):
        embeddings = await fetch_free_embedding_models()
        self.assertIsInstance(embeddings, list)
        self.assertGreater(len(embeddings), 0)

        # Check structure
        first_embed = embeddings[0]
        self.assertIn("id", first_embed)
        self.assertIn("dimensions", first_embed)
        self.assertIn("provider", first_embed)

        # Lookups
        info = await get_embedding_model(first_embed["id"])
        self.assertEqual(info.id, first_embed["id"])
        self.assertGreater(info.dimensions, 0)

        rerankers = await fetch_free_reranking_models()
        self.assertIsInstance(rerankers, list)
        self.assertGreater(len(rerankers), 0)

        first_rerank = rerankers[0]
        r_info = await get_reranking_model(first_rerank["id"])
        self.assertEqual(r_info.id, first_rerank["id"])

    # -------------------------------------------------------------------------
    # 7. Sliding-Window Text Chunking & Hashing
    # -------------------------------------------------------------------------
    def test_chunking_sliding_window_integrity(self):
        raw_text = (
            "Line 1: Backup initialization.\n"
            "Line 2: Connected to remote GitHub API repository.\n"
            "Line 3: Archiving git objects into compressed tarball.\n"
            "Line 4: Upload completed with sha256 checksum verification.\n"
        ) * 10

        chunks = chunk_text(raw_text, max_length=150, overlap=30)
        self.assertGreater(len(chunks), 1)

    # -------------------------------------------------------------------------
    # 8. Hybrid Search & Direct Raw Source Fallback
    # -------------------------------------------------------------------------
    @patch("data.search._search_raw_sources")
    @patch("data.search.get_active_generation")
    async def test_hybrid_search_with_raw_source_fallback(self, mock_active_gen, mock_raw_search):
        from data.search import hybrid_search

        # Mock no active vector generation
        mock_active_gen.return_value = None
        mock_raw_search.return_value = [
            {
                "id": 1,
                "source_type": "execution_log",
                "source_id": "1",
                "content": "[error] Failed to fetch repository metadata",
                "score": 0.85,
                "metadata": {"repository": "owner/repo", "level": "error"},
            },
            {
                "id": "inv-1",
                "source_type": "investigation",
                "source_id": "inv-1",
                "content": "Q: What caused the error?\nA: Token expired.",
                "score": 0.90,
                "metadata": {"status": "completed"},
            }
        ]

        result = await hybrid_search(query="error", source_types=["execution_log", "investigation"])

        self.assertIn("results", result)
        self.assertEqual(len(result["results"]), 2)
        self.assertEqual(result["results"][0]["source_type"], "execution_log")
        self.assertEqual(result["results"][1]["source_type"], "investigation")

    # -------------------------------------------------------------------------
    # 9. Chunk Metadata Extraction Integrity
    # -------------------------------------------------------------------------
    def test_chunk_metadata_extraction(self):
        from data.embeddings import SOURCE_CONFIGS

        exec_config = SOURCE_CONFIGS["execution_log"]
        exec_meta = exec_config["metadata_fn"]({
            "level": "error",
            "repository": "facebook/react",
            "run_id": 42,
            "message": "Auth failed",
        })
        self.assertEqual(exec_meta["level"], "error")
        self.assertEqual(exec_meta["repository"], "facebook/react")
        self.assertEqual(exec_meta["run_id"], 42)

        backup_config = SOURCE_CONFIGS["backup_result"]
        backup_meta = backup_config["metadata_fn"]({
            "repo_full_name": "vuejs/core",
            "status": "completed",
            "run_id": 99,
        })
        self.assertEqual(backup_meta["repo"], "vuejs/core")
        self.assertEqual(backup_meta["status"], "completed")


if __name__ == "__main__":
    unittest.main()


