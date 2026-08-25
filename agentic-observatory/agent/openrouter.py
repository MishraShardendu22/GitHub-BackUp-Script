from __future__ import annotations

import time
import json
import asyncio

active_confirmations: dict[str, asyncio.Event] = {}
active_responses: dict[str, bool] = {}

from data.tools import (
    list_backup_runs,
    send_report_email,
    list_backup_fixes,
    list_execution_logs,
    fetch_backup_metrics,
    fetch_latest_backup_run,
    fetch_analytics_for_run,
    fetch_backup_fix_details,
    fetch_backup_run_details,
    list_historical_analytics,
    list_tracked_repositories,
    fetch_dashboard_statistics,
    fetch_latest_analytics_snapshot,
    hybrid_search_knowledge_base,
)
from pydantic import SecretStr
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    ToolMessage,
    HumanMessage,
    SystemMessage,
)
from config import settings
from utils.logging import logger
from typing import AsyncIterator
from .prompts import SYSTEM_PROMPT
from langchain_openrouter import ChatOpenRouter
from .state import AgentResponse, ToolExecution, create_request_id, safe_serialize_payload

TOOLS = [
    hybrid_search_knowledge_base,
    list_backup_runs,
    send_report_email,
    list_backup_fixes,
    list_execution_logs,
    fetch_backup_metrics,
    fetch_latest_backup_run,
    fetch_analytics_for_run,
    fetch_backup_fix_details,
    fetch_backup_run_details,
    list_historical_analytics,
    list_tracked_repositories,
    fetch_dashboard_statistics,
    fetch_latest_analytics_snapshot,
]

from utils.openrouter_keys import get_active_openrouter_key, rotate_openrouter_key

TOOLS_BY_NAME = {tool.name: tool for tool in TOOLS}


def get_llm(model: str | None = None, api_key: str | None = None) -> ChatOpenRouter:
    key = api_key or get_active_openrouter_key()
    return ChatOpenRouter(
        temperature=0.2,
        model=model or settings.OPENROUTER_MODEL,
        api_key=SecretStr(key) if key else None,
    )


def get_bound_llm(model: str | None = None, api_key: str | None = None):
    return get_llm(model=model, api_key=api_key).bind_tools(TOOLS, strict=True)


async def _retrieve_hybrid_context(question: str) -> tuple[str, list[dict]]:
    """Retrieve database context using hybrid search (FTS + Vector + RRF)."""
    try:
        from data.search import hybrid_search
        search_res = await hybrid_search(question, limit=5)
        results = search_res.get("results", [])
        if not results:
            return SYSTEM_PROMPT, []

        formatted = []
        for r in results:
            formatted.append(
                f"- [{r.get('source_type')} | ID: {r.get('source_id')} | Score: {r.get('score')}]\n  {r.get('content')}"
            )

        rag_prompt = (
            SYSTEM_PROMPT
            + "\n\n=== RETRIEVED HYBRID SEARCH CONTEXT (FTS + pgvector + RRF) ===\n"
            + "\n".join(formatted)
            + "\n========================================================"
        )
        return rag_prompt, results
    except Exception as e:
        logger.warning(f"Hybrid search context retrieval failed: {e}")
        return SYSTEM_PROMPT, []


async def invoke_agent(
    question: str,
    session_id: str | None = None,
    request_id: str | None = None,
    model: str | None = None,
) -> AgentResponse:
    request_id = request_id or create_request_id()
    start = time.perf_counter()
    llm = get_bound_llm(model=model)

    system_prompt_content, retrieved_sources = await _retrieve_hybrid_context(question)

    history_messages: list[BaseMessage] = []
    if session_id:
        try:
            from data.persistence import persistence_store
            db_messages = await persistence_store.get_session_messages(session_id)
            for msg in db_messages:
                role = msg.get("role")
                content = msg.get("content")
                if role == "user":
                    history_messages.append(HumanMessage(content=content or ""))
                elif role == "assistant":
                    history_messages.append(AIMessage(content=content or ""))
        except Exception as e:
            logger.error(f"[session_id={session_id}] Failed to load history messages: {e}")

    messages: list[BaseMessage] = [
        SystemMessage(content=system_prompt_content),
    ]
    messages.extend(history_messages)
    messages.append(HumanMessage(content=question))

    logger.info(f"[request_id={request_id}] Agent question: {question}")

    executed_tools: list[ToolExecution] = []
    
    for iteration in range(5):
        logger.info(f"[request_id={request_id}] LLM Turn {iteration + 1}...")
        response = await llm.ainvoke(messages)
        messages.append(response)
        
        if not response.tool_calls:
            duration = time.perf_counter() - start
            logger.info(f"[request_id={request_id}] Agent completed in {duration:.2f}s after {iteration + 1} turns")
            return AgentResponse(
                request_id=request_id,
                question=question,
                answer=extract_text_from_chunk(response) or "",
                tool_calls=executed_tools,
                tool_results=[tool.model_dump() for tool in executed_tools],
                retrieved_sources=retrieved_sources,
            )

        logger.info(f"[request_id={request_id}] Turn {iteration + 1} Tool calls: {response.tool_calls}")

        for tool_call in response.tool_calls:
            tool_args = tool_call["args"]
            tool_name = tool_call["name"]
            
            logger.debug(f"[request_id={request_id}] Tool args: {tool_args}")
            logger.info(f"[request_id={request_id}] Executing tool: {tool_name}")
            
            tool_start = time.perf_counter()
            try:
                tool = TOOLS_BY_NAME[tool_name]
                tool_result = await tool.ainvoke(tool_args)
                tool_duration_ms = (time.perf_counter() - tool_start) * 1000
                executed_tool = ToolExecution(
                    name=tool_name,
                    args=tool_args,
                    success=True,
                    duration_ms=tool_duration_ms,
                    result=tool_result,
                )
                executed_tools.append(executed_tool)
                messages.append(
                    ToolMessage(
                        content=safe_serialize_payload(tool_result),
                        tool_call_id=tool_call["id"],
                    )
                )
                logger.info(
                    f"[request_id={request_id}] Tool success: {tool_name} ({tool_duration_ms:.2f}ms)"
                )
            except Exception as exc:
                tool_duration_ms = (time.perf_counter() - tool_start) * 1000
                executed_tool = ToolExecution(
                    name=tool_name,
                    args=tool_args,
                    success=False,
                    duration_ms=tool_duration_ms,
                    error=str(exc),
                )
                executed_tools.append(executed_tool)
                messages.append(
                    ToolMessage(
                        content=safe_serialize_payload(f"Tool execution failed: {str(exc)}"),
                        tool_call_id=tool_call["id"],
                    )
                )
                logger.error(
                    f"[request_id={request_id}] Tool failed: {tool_name} ({tool_duration_ms:.2f}ms) error={str(exc)}"
                )
                
    duration = time.perf_counter() - start
    logger.warn(f"[request_id={request_id}] Agent hit loop limit (5) and forced completion in {duration:.2f}s")
    return AgentResponse(
        request_id=request_id,
        question=question,
        answer=extract_text_from_chunk(messages[-1]) or "Reasoning loop execution limit reached.",
        tool_calls=executed_tools,
        tool_results=[tool.model_dump() for tool in executed_tools],
    )


def extract_text_from_chunk(chunk) -> str:
    content = getattr(chunk, "content", None)
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, str):
                text_parts.append(item)
            elif isinstance(item, dict):
                text_parts.append(item.get("text", "") or item.get("content", ""))
        return "".join(text_parts)

    if hasattr(chunk, "content_blocks"):
        text_parts = []
        for block in getattr(chunk, "content_blocks", []) or []:
            if isinstance(block, str):
                text_parts.append(block)
            elif hasattr(block, "text"):
                text_parts.append(getattr(block, "text", ""))
            elif isinstance(block, dict):
                text_parts.append(block.get("text", "") or block.get("content", ""))
        return "".join(text_parts)

    return ""


async def _stream_final_answer(llm, messages, request_id: str, start: float) -> AsyncIterator[str]:
    async for chunk in llm.astream(messages):
        token = extract_text_from_chunk(chunk)
        if token:
            yield token

    duration = time.perf_counter() - start
    logger.info(f"[request_id={request_id}] Streamed final answer in {duration:.2f}s")


async def stream_agent(
    question: str,
    session_id: str | None = None,
    request_id: str | None = None,
    model: str | None = None,
) -> AsyncIterator[str]:
    request_id = request_id or create_request_id()
    start = time.perf_counter()
    llm = get_bound_llm(model=model)

    # Retrieve hybrid search RAG context
    system_prompt_content, retrieved_sources = await _retrieve_hybrid_context(question)

    # Yield info event first with retrieved hybrid search sources
    yield json.dumps({
        "type": "info",
        "request_id": request_id,
        "session_id": session_id,
        "sources": retrieved_sources,
    })

    # Load history messages if session_id is provided
    history_messages: list[BaseMessage] = []
    if session_id:
        try:
            from data.persistence import persistence_store
            db_messages = await persistence_store.get_session_messages(session_id)
            for msg in db_messages:
                role = msg.get("role")
                content = msg.get("content")
                if role == "user":
                    history_messages.append(HumanMessage(content=content or ""))
                elif role == "assistant":
                    history_messages.append(AIMessage(content=content or ""))
        except Exception as e:
            logger.error(f"[session_id={session_id}] Failed to load history messages: {e}")

    messages: list[BaseMessage] = [
        SystemMessage(content=system_prompt_content),
    ]
    messages.extend(history_messages)
    messages.append(HumanMessage(content=question))

    logger.info(f"[request_id={request_id}] Agent question: {question}")

    executed_tools: list[ToolExecution] = []
    
    for iteration in range(5):
        yield json.dumps({"type": "agent_reasoning", "iteration": iteration, "request_id": request_id})
        
        logger.info(f"[request_id={request_id}] LLM Turn {iteration + 1}...")
        response = await llm.ainvoke(messages)
        messages.append(response)
        
        if not response.tool_calls:
            messages.pop()
            answer_parts = []
            async for token in _stream_final_answer(llm, messages, request_id, start):
                answer_parts.append(token)
                yield json.dumps({"type": "token", "text": token})
                
            answer = "".join(answer_parts)
            yield json.dumps({"type": "done", "answer": answer, "request_id": request_id})
            return
            
        logger.info(f"[request_id={request_id}] Turn {iteration + 1} Tool calls: {response.tool_calls}")
        for tool_call in response.tool_calls:
            tool_args = tool_call["args"]
            tool_name = tool_call["name"]
            
            if tool_name == "send_report_email":
                import uuid
                confirm_id = str(uuid.uuid4())
                confirm_event = asyncio.Event()
                active_confirmations[confirm_id] = confirm_event

                yield json.dumps({
                    "type": "confirm_required",
                    "confirm_id": confirm_id,
                    "name": tool_name,
                    "args": tool_args
                })
                
                try:
                    await asyncio.wait_for(confirm_event.wait(), timeout=120.0)
                    approved = active_responses.get(confirm_id, False)
                except asyncio.TimeoutError:
                    approved = False
                finally:
                    active_confirmations.pop(confirm_id, None)
                    active_responses.pop(confirm_id, None)
                    
                if not approved:
                    yield json.dumps({
                        "type": "tool_end",
                        "name": tool_name,
                        "success": False,
                        "error": "Email transmission rejected by user."
                    })
                    messages.append(
                        ToolMessage(
                            content="Tool execution rejected by user. The email report was NOT sent.",
                            tool_call_id=tool_call["id"],
                        )
                    )
                    continue

            yield json.dumps({"type": "tool_start", "name": tool_name, "args": tool_args})
            
            logger.debug(f"[request_id={request_id}] Tool args: {tool_args}")
            logger.info(f"[request_id={request_id}] Executing tool: {tool_name}")
            
            tool_start = time.perf_counter()
            try:
                tool = TOOLS_BY_NAME[tool_name]
                tool_result = await tool.ainvoke(tool_args)
                tool_duration_ms = (time.perf_counter() - tool_start) * 1000
                executed_tool = ToolExecution(
                    name=tool_name,
                    args=tool_args,
                    success=True,
                    duration_ms=tool_duration_ms,
                    result=tool_result,
                )
                executed_tools.append(executed_tool)
                
                messages.append(
                    ToolMessage(
                        content=safe_serialize_payload(tool_result),
                        tool_call_id=tool_call["id"],
                    )
                )
                
                yield json.dumps({
                    "type": "tool_end",
                    "name": tool_name,
                    "success": True,
                    "duration_ms": tool_duration_ms,
                    "result": tool_result,
                })
                logger.info(
                    f"[request_id={request_id}] Tool success: {tool_name} ({tool_duration_ms:.2f}ms)"
                )
            except Exception as exc:
                tool_duration_ms = (time.perf_counter() - tool_start) * 1000
                executed_tool = ToolExecution(
                    name=tool_name,
                    args=tool_args,
                    success=False,
                    duration_ms=tool_duration_ms,
                    error=str(exc),
                )
                executed_tools.append(executed_tool)
                
                messages.append(
                    ToolMessage(
                        content=f"Tool execution failed: {str(exc)}",
                        tool_call_id=tool_call["id"],
                    )
                )
                
                yield json.dumps({
                    "type": "tool_end",
                    "name": tool_name,
                    "success": False,
                    "duration_ms": tool_duration_ms,
                    "error": str(exc),
                })
                logger.error(
                    f"[request_id={request_id}] Tool failed: {tool_name} ({tool_duration_ms:.2f}ms) error={str(exc)}"
                )
                
    yield json.dumps({"type": "done", "answer": "Reasoning loop execution limit reached.", "request_id": request_id})
