from __future__ import annotations

import time
import json
import asyncio
from typing import Any

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

def get_agent_tools() -> list[Any]:
    return TOOLS

from utils.openrouter_keys import get_active_openrouter_key, rotate_openrouter_key

TOOLS_BY_NAME = {tool.name: tool for tool in TOOLS}

# Initialize the LLM with active OpenRouter key from failover pool
def get_llm(model: str | None = None, api_key: str | None = None) -> ChatOpenRouter:
    key = api_key or get_active_openrouter_key()
    return ChatOpenRouter(
        temperature=0.2,
        model=model or settings.OPENROUTER_MODEL,
        api_key=SecretStr(key) if key else None,
    )

# Bind tools to the LLM, so that it can call them when needed
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


# Main function to invoke the agent with a user question,
# handle tool calls, and return the final answer
async def _fetch_session_history(session_id: str | None) -> list[BaseMessage]:
    """Fetch session history messages concurrently."""
    history_messages: list[BaseMessage] = []
    if not session_id:
        return history_messages
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
    return history_messages


# Main function to invoke the agent with a user question,
# handle tool calls, and return the final answer
async def invoke_agent(
    question: str,
    session_id: str | None = None,
    request_id: str | None = None,
    model: str | None = None,
) -> AgentResponse:
    request_id = request_id or create_request_id()
    start = time.perf_counter()
    llm = get_bound_llm(model=model)

    # Retrieve hybrid search RAG context and session history concurrently
    (system_prompt_content, retrieved_sources), history_messages = await asyncio.gather(
        _retrieve_hybrid_context(question),
        _fetch_session_history(session_id),
    )

    # initialize the conversation with a system prompt, history, and the user's question
    messages: list[BaseMessage] = [
        SystemMessage(content=system_prompt_content),
    ]
    messages.extend(history_messages)
    messages.append(HumanMessage(content=question))

    logger.info(f"[request_id={request_id}] Agent question: {question}")

    # Loop to allow multi-turn tool calling (up to 5 iterations)
    executed_tools: list[ToolExecution] = []
    
    for iteration in range(5):
        logger.info(f"[request_id={request_id}] LLM Turn {iteration + 1}...")
        response = await llm.ainvoke(messages)
        messages.append(response)
        
        if not response.tool_calls:
            # Final answer received
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

        async def _run_tool(tool_call: Any) -> tuple[ToolExecution, ToolMessage]:
            tool_args = tool_call["args"]
            tool_name = tool_call["name"]
            logger.debug(f"[request_id={request_id}] Tool args: {tool_args}")
            logger.info(f"[request_id={request_id}] Executing tool: {tool_name}")
            tool_start = time.perf_counter()
            try:
                tool = TOOLS_BY_NAME[tool_name]
                tool_result = await tool.ainvoke(tool_args)
                tool_duration_ms = (time.perf_counter() - tool_start) * 1000
                exec_tool = ToolExecution(
                    name=tool_name,
                    args=tool_args,
                    success=True,
                    duration_ms=tool_duration_ms,
                    result=tool_result,
                )
                msg = ToolMessage(
                    content=safe_serialize_payload(tool_result),
                    tool_call_id=tool_call["id"],
                )
                logger.info(
                    f"[request_id={request_id}] Tool success: {tool_name} ({tool_duration_ms:.2f}ms)"
                )
                return exec_tool, msg
            except Exception as exc:
                tool_duration_ms = (time.perf_counter() - tool_start) * 1000
                exec_tool = ToolExecution(
                    name=tool_name,
                    args=tool_args,
                    success=False,
                    duration_ms=tool_duration_ms,
                    error=str(exc),
                )
                msg = ToolMessage(
                    content=safe_serialize_payload(f"Tool execution failed: {str(exc)}"),
                    tool_call_id=tool_call["id"],
                )
                logger.error(
                    f"[request_id={request_id}] Tool failed: {tool_name} ({tool_duration_ms:.2f}ms) error={str(exc)}"
                )
                return exec_tool, msg

        # Execute multiple tools in parallel
        tool_outcomes = await asyncio.gather(*[_run_tool(tc) for tc in response.tool_calls])
        for exec_tool, tool_msg in tool_outcomes:
            executed_tools.append(exec_tool)
            messages.append(tool_msg)
                
    # Fallback if iterations exceed 5
    duration = time.perf_counter() - start
    logger.warn(f"[request_id={request_id}] Agent hit loop limit (5) and forced completion in {duration:.2f}s")
    return AgentResponse(
        request_id=request_id,
        question=question,
        answer=extract_text_from_chunk(messages[-1]) or "Reasoning loop execution limit reached.",
        tool_calls=executed_tools,
        tool_results=[tool.model_dump() for tool in executed_tools],
    )


# Take a streaming LLM chunk and extract only the text from it.
# regardless of how the provider formats the chunk.
def extract_text_from_chunk(chunk) -> str:
    # get content safely, wont crash if content is not present, will return None
    content = getattr(chunk, "content", None)

    # if the content is a string, return it directly
    if isinstance(content, str):
        return content

    # if the content is a list, concatenate all the text parts and return it
    if isinstance(content, list):
        text_parts = []
        for item in content:
            # the item can be a string, apped it directly
            if isinstance(item, str):
                text_parts.append(item)

            # the item can be an object with a text attribute, get the text attribute and append it
            elif isinstance(item, dict):
                text_parts.append(item.get("text", "") or item.get("content", ""))

        # concatenate all the text parts and return it
        return "".join(text_parts)

    # some providers store text differently
    # do the above cases wiht the content_blocks attribute instead of content
    # some store it as chunk.content_blocks = [...] instead of chunk.content = [...]
    if hasattr(chunk, "content_blocks"):
        text_parts = []
        for block in getattr(chunk, "content_blocks", []) or []:
            if isinstance(block, str):
                text_parts.append(block)
            elif hasattr(block, "text"):
                text_parts.append(getattr(block, "text", ""))
            elif isinstance(block, dict):
                text_parts.append(block.get("text", "") or block.get("content", ""))
        
        # concatenate all the text parts and return it 
        return "".join(text_parts)

    # final fall back
    return ""


# an asynchronous generator function, it yields tokens asynchronously as they are generated by the LLM, and also executes tool calls and feeds the results back to the LLM for a final answer
async def _stream_final_answer(llm, messages, request_id: str, start: float) -> AsyncIterator[str]:
    async for chunk in llm.astream(messages):
        token = extract_text_from_chunk(chunk)
        if token:
            yield token

    duration = time.perf_counter() - start
    logger.info(f"[request_id={request_id}] Streamed final answer in {duration:.2f}s")


# same as invoke_agent but it streams the final answer back to the client as it is generated by the LLM, instead of waiting for the final answer to be generated and then returning it
async def stream_agent(
    question: str,
    session_id: str | None = None,
    request_id: str | None = None,
    model: str | None = None,
) -> AsyncIterator[str]:
    # if request_id is not provided, create a new one
    request_id = request_id or create_request_id()

    # start the timer to measure the total time taken by the agent to generate the final answer
    start = time.perf_counter()

    # get the LLM instance with tools bound to it
    llm = get_bound_llm(model=model)

    # Retrieve hybrid search RAG context and session history concurrently
    (system_prompt_content, retrieved_sources), history_messages = await asyncio.gather(
        _retrieve_hybrid_context(question),
        _fetch_session_history(session_id),
    )

    # Yield info event first with retrieved hybrid search sources
    yield json.dumps({
        "type": "info",
        "request_id": request_id,
        "session_id": session_id,
        "sources": retrieved_sources,
    })

    # initialize the conversation with a system prompt, history, and the user's question
    messages: list[BaseMessage] = [
        SystemMessage(content=system_prompt_content),
    ]

    messages.extend(history_messages)
    messages.append(HumanMessage(content=question))

    logger.info(f"[request_id={request_id}] Agent question: {question}")

    executed_tools: list[ToolExecution] = []
    
    for iteration in range(5):
        # Yield a status update: LLM reasoning
        yield json.dumps({"type": "agent_reasoning", "iteration": iteration, "request_id": request_id})
        
        logger.info(f"[request_id={request_id}] LLM Turn {iteration + 1}...")
        response = await llm.ainvoke(messages)
        messages.append(response)
        
        if not response.tool_calls:
            # Final answer received directly from LLM reasoning turn without redundant extra API calls
            duration = time.perf_counter() - start
            logger.info(f"[request_id={request_id}] Final answer generated in {duration:.2f}s after {iteration + 1} turns")
            answer = extract_text_from_chunk(response) or ""
            
            # Stream tokens of the generated answer smoothly to client
            if answer:
                words = answer.split(" ")
                for i, word in enumerate(words):
                    token = word + (" " if i < len(words) - 1 else "")
                    yield json.dumps({"type": "token", "text": token})
                    await asyncio.sleep(0.005)
                    
            yield json.dumps({"type": "done", "answer": answer, "request_id": request_id})
            return
            
        # Execute tool calls concurrently
        logger.info(f"[request_id={request_id}] Turn {iteration + 1} Tool calls: {response.tool_calls}")
        
        # Yield tool start & confirmation events for all tools
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
                    "args": tool_args,
                })
                
            yield json.dumps({
                "type": "tool_start",
                "name": tool_name,
                "args": tool_args,
            })

        async def _run_stream_tool(tool_call: Any) -> tuple[ToolExecution, ToolMessage, dict[str, Any]]:
            tool_args = tool_call["args"]
            tool_name = tool_call["name"]
            
            # HUMAN IN THE LOOP MIDDLEWARE FOR SENSITIVE EMAIL ACTIONS
            if tool_name == "send_report_email":
                approved = False
                for cid, ev in list(active_confirmations.items()):
                    try:
                        await asyncio.wait_for(ev.wait(), timeout=120.0)
                        approved = active_responses.get(cid, False)
                    except asyncio.TimeoutError:
                        approved = False
                    finally:
                        active_confirmations.pop(cid, None)
                        active_responses.pop(cid, None)
                    break
                    
                if not approved:
                    tool_end_evt = {
                        "type": "tool_end",
                        "name": tool_name,
                        "success": False,
                        "error": "Email transmission rejected by user.",
                    }
                    exec_t = ToolExecution(
                        name=tool_name,
                        args=tool_args,
                        success=False,
                        duration_ms=0.0,
                        error="Email transmission rejected by user.",
                    )
                    t_msg = ToolMessage(
                        content="Tool execution rejected by user. The email report was NOT sent.",
                        tool_call_id=tool_call["id"],
                    )
                    return exec_t, t_msg, tool_end_evt

            logger.debug(f"[request_id={request_id}] Tool args: {tool_args}")
            logger.info(f"[request_id={request_id}] Executing tool: {tool_name}")
            tool_start = time.perf_counter()
            try:
                tool = TOOLS_BY_NAME[tool_name]
                tool_result = await tool.ainvoke(tool_args)
                tool_duration_ms = (time.perf_counter() - tool_start) * 1000
                exec_t = ToolExecution(
                    name=tool_name,
                    args=tool_args,
                    success=True,
                    duration_ms=tool_duration_ms,
                    result=tool_result,
                )
                t_msg = ToolMessage(
                    content=safe_serialize_payload(tool_result),
                    tool_call_id=tool_call["id"],
                )
                tool_end_evt = {
                    "type": "tool_end",
                    "name": tool_name,
                    "success": True,
                    "duration_ms": tool_duration_ms,
                    "result": tool_result,
                }
                logger.info(f"[request_id={request_id}] Tool success: {tool_name} ({tool_duration_ms:.2f}ms)")
                return exec_t, t_msg, tool_end_evt
            except Exception as exc:
                tool_duration_ms = (time.perf_counter() - tool_start) * 1000
                exec_t = ToolExecution(
                    name=tool_name,
                    args=tool_args,
                    success=False,
                    duration_ms=tool_duration_ms,
                    error=str(exc),
                )
                t_msg = ToolMessage(
                    content=safe_serialize_payload(f"Tool execution failed: {str(exc)}"),
                    tool_call_id=tool_call["id"],
                )
                tool_end_evt = {
                    "type": "tool_end",
                    "name": tool_name,
                    "success": False,
                    "duration_ms": tool_duration_ms,
                    "error": str(exc),
                }
                logger.error(f"[request_id={request_id}] Tool failed: {tool_name} ({tool_duration_ms:.2f}ms) error={str(exc)}")
                return exec_t, t_msg, tool_end_evt

        # Execute multiple tools concurrently
        tool_outcomes = await asyncio.gather(*[_run_stream_tool(tc) for tc in response.tool_calls])
        for exec_t, t_msg, tool_end_evt in tool_outcomes:
            executed_tools.append(exec_t)
            messages.append(t_msg)
            yield json.dumps(tool_end_evt)
                
    # Loop limit reached fallback
    yield json.dumps({"type": "done", "answer": "Reasoning loop execution limit reached.", "request_id": request_id})
