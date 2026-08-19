"""Agent Test Template & Test Suite.

Provides standardized test patterns and mocks for:
1. Multi-turn Agent Reasoning & Tool Invocation
2. Streaming Event Parsing & Chunk Extraction
3. Human-In-The-Loop (HITL) Action Approvals
4. Multi-Key OpenRouter Failover & Rotation
5. Tool Serialization & Execution Safety
6. Hybrid Search RAG Context Formatting

Use this file as a template when writing new unit and integration tests for AI agent features.
"""

from __future__ import annotations

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from agent.openrouter import extract_text_from_chunk, invoke_agent
from agent.state import AgentResponse, ToolExecution, safe_serialize_payload
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


class TestAgentSuiteTemplate(unittest.IsolatedAsyncioTestCase):
    """Standardized test suite template for agent features."""

    # -------------------------------------------------------------------------
    # 1. Text & Chunk Extraction Tests
    # -------------------------------------------------------------------------
    def test_extract_text_from_string_chunk(self):
        chunk = MockLLMChunk(content="Hello World")
        self.assertEqual(extract_text_from_chunk(chunk), "Hello World")

    def test_extract_text_from_list_chunk(self):
        chunk = MockLLMChunk(content=[{"text": "Part 1 "}, {"text": "Part 2"}])
        self.assertEqual(extract_text_from_chunk(chunk), "Part 1 Part 2")

    def test_extract_text_from_content_blocks(self):
        chunk = MockLLMChunk(content_blocks=[{"text": "Block 1 "}, "Block 2"])
        self.assertEqual(extract_text_from_chunk(chunk), "Block 1 Block 2")

    def test_safe_serialize_payload(self):
        data = {"count": 10, "status": "ok", "nested": {"key": "val"}}
        serialized = safe_serialize_payload(data)
        self.assertIn('"count": 10', serialized)

    # -------------------------------------------------------------------------
    # 2. Multi-Key Failover Unit Tests
    # -------------------------------------------------------------------------
    def test_multi_key_parsing_and_rotation(self):
        with patch("utils.openrouter_keys.settings.OPENROUTER_API_KEY", "sk-key-1, sk-key-2 , sk-key-3"):
            from utils import openrouter_keys
            with openrouter_keys._lock:
                openrouter_keys._current_key_index = 0

            keys = get_openrouter_api_keys()
            self.assertEqual(len(keys), 3)
            self.assertEqual(get_active_openrouter_key(), "sk-key-1")

            # Simulate failover on 429
            new_key = rotate_openrouter_key(failed_key="sk-key-1", reason="429 Rate Limit")
            self.assertEqual(new_key, "sk-key-2")
            self.assertEqual(get_active_openrouter_key(), "sk-key-2")

    # -------------------------------------------------------------------------
    # 3. Agent Invocation with Mocked LLM (Single Turn)
    # -------------------------------------------------------------------------
    @patch("agent.openrouter.get_bound_llm")
    @patch("agent.openrouter._retrieve_hybrid_context")
    async def test_agent_single_turn_answer(self, mock_retrieve, mock_llm_getter):
        mock_retrieve.return_value = ("System Prompt", [])

        # Mock LLM returning immediate answer with no tool calls
        mock_response = MagicMock()
        mock_response.tool_calls = []
        mock_response.content = "All 15 backup repositories succeeded."

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)
        mock_llm_getter.return_value = mock_llm

        response: AgentResponse = await invoke_agent(
            question="What is the backup status?",
            session_id=None,
        )

        self.assertIsInstance(response, AgentResponse)
        self.assertEqual(response.answer, "All 15 backup repositories succeeded.")
        self.assertEqual(len(response.tool_calls), 0)

    # -------------------------------------------------------------------------
    # 4. Agent Multi-Turn Tool Calling Flow
    # -------------------------------------------------------------------------
    @patch("agent.openrouter.TOOLS_BY_NAME")
    @patch("agent.openrouter.get_bound_llm")
    @patch("agent.openrouter._retrieve_hybrid_context")
    async def test_agent_tool_calling_loop(self, mock_retrieve, mock_llm_getter, mock_tools):
        mock_retrieve.return_value = ("System Prompt", [])

        # Turn 1: LLM decides to call tool 'fetch_backup_metrics'
        turn_1_resp = MagicMock()
        turn_1_resp.tool_calls = [{
            "id": "call_123",
            "name": "fetch_backup_metrics",
            "args": {"limit": 5},
        }]
        turn_1_resp.content = ""

        # Turn 2: LLM provides final answer after receiving tool output
        turn_2_resp = MagicMock()
        turn_2_resp.tool_calls = []
        turn_2_resp.content = "Backup metrics show 100% success rate."

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[turn_1_resp, turn_2_resp])
        mock_llm_getter.return_value = mock_llm

        # Mock tool execution
        mock_tool = MagicMock()
        mock_tool.ainvoke = AsyncMock(return_value={"total_runs": 10, "success_rate": 100})
        mock_tools.__getitem__.return_value = mock_tool

        response: AgentResponse = await invoke_agent(
            question="Show me the backup metrics.",
            session_id=None,
        )

        self.assertEqual(response.answer, "Backup metrics show 100% success rate.")
        self.assertEqual(len(response.tool_calls), 1)
        self.assertEqual(response.tool_calls[0].name, "fetch_backup_metrics")
        self.assertTrue(response.tool_calls[0].success)

    # -------------------------------------------------------------------------
    # 5. Human-In-The-Loop (HITL) Event Confirmation Pattern
    # -------------------------------------------------------------------------
    def test_human_in_the_loop_event_pattern(self):
        from agent.openrouter import active_confirmations, active_responses
        confirm_id = "test-confirm-uuid-1234"

        event = asyncio.Event()
        active_confirmations[confirm_id] = event

        # Simulate user approving action via /chat/confirm endpoint
        active_responses[confirm_id] = True
        event.set()

        self.assertTrue(event.is_set())
        self.assertTrue(active_responses[confirm_id])

        # Cleanup
        active_confirmations.pop(confirm_id, None)
        active_responses.pop(confirm_id, None)

    # -------------------------------------------------------------------------
    # 6. Tool-Calling RAG Hybrid Search Invocations
    # -------------------------------------------------------------------------
    @patch("agent.openrouter.TOOLS_BY_NAME")
    @patch("agent.openrouter.get_bound_llm")
    @patch("agent.openrouter._retrieve_hybrid_context")
    async def test_agent_hybrid_search_rag_tool_calling(self, mock_retrieve, mock_llm_getter, mock_tools):
        mock_retrieve.return_value = ("System Prompt", [])

        # Turn 1: LLM calls hybrid_search_knowledge_base to retrieve chunks
        turn_1_resp = MagicMock()
        turn_1_resp.tool_calls = [{
            "id": "call_rag_999",
            "name": "hybrid_search_knowledge_base",
            "args": {"query": "authentication timeout", "source_types": ["execution_log"], "limit": 3},
        }]
        turn_1_resp.content = ""

        # Turn 2: LLM answers using retrieved chunks
        turn_2_resp = MagicMock()
        turn_2_resp.tool_calls = []
        turn_2_resp.content = "Found 2 logs indicating GitHub API rate limit 403 on token refresh."

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[turn_1_resp, turn_2_resp])
        mock_llm_getter.return_value = mock_llm

        mock_tool = MagicMock()
        mock_tool.ainvoke = AsyncMock(return_value={
            "results": [
                {"source_type": "execution_log", "source_id": "42", "content": "HTTP 403 Rate limit exceeded", "score": 0.089}
            ],
            "total": 1,
        })
        mock_tools.__getitem__.return_value = mock_tool

        response: AgentResponse = await invoke_agent(
            question="Investigate authentication timeout errors in logs.",
            session_id=None,
        )

        self.assertEqual(response.answer, "Found 2 logs indicating GitHub API rate limit 403 on token refresh.")
        self.assertEqual(len(response.tool_calls), 1)
        self.assertEqual(response.tool_calls[0].name, "hybrid_search_knowledge_base")
        self.assertTrue(response.tool_calls[0].success)


if __name__ == "__main__":
    unittest.main()

