from __future__ import annotations

import json
from typing import Any
from uuid import uuid4
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

# Every investigation/chat/request gets a unique ID.
def create_request_id() -> str:
    return str(uuid4())

# onlt keep the first 15,000 characters of a string
def truncate_text(value: str, max_length: int = 15000) -> str:
    if not isinstance(value, str):
        value = str(value)
    return value if len(value) <= max_length else value[:max_length]

# convert anything into a JSON string safely.
# Example: if the value is a dict, it will be converted to a JSON string.

# This will fail in json.dumps 
# payload = {
#     "repo": "test",
#     "time": datetime.utcnow()
# }

# This is what truncate text will do to it:
# {
#   "repo":"test",
#   "time":"2026-06-18 08:00:00"
# }
def safe_serialize_payload(value: Any, max_length: int = 15000) -> str:
    try:
        text = json.dumps(value, default=str, ensure_ascii=False)
    except Exception:
        text = str(value)
    return truncate_text(text, max_length=max_length)

# Models 
class ToolExecution(BaseModel):
    name: str
    success: bool
    duration_ms: float | None = None
    args: dict[str, Any] | None = None
    error: str | None = None
    result: Any | None = None
    tool_call_id: str | None = None


class AgentResponse(BaseModel):
    request_id: str
    question: str
    answer: str
    tool_calls: list[ToolExecution] = Field(default_factory=list)
    tool_results: list[dict[str, Any]] = Field(default_factory=list)
    retrieved_sources: list[dict[str, Any]] = Field(default_factory=list)
    status: str = "completed"
    created_at: datetime = Field(default_factory=datetime.utcnow)



class ConversationState(BaseModel):
    session_id: str | None = None
    request_id: str
    question: str
    messages: list[dict[str, Any]] = Field(default_factory=list)
    tool_calls: list[ToolExecution] = Field(default_factory=list)
    tool_results: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AgentState(BaseModel):
    request_id: str
    question: str
    answer: str | None = None
    messages: list[dict[str, Any]] = Field(default_factory=list)
    tool_calls: list[ToolExecution] = Field(default_factory=list)
    tool_results: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class InvestigationRecord(BaseModel):
    request_id: str
    question: str
    answer: str | None = None
    tool_calls: list[ToolExecution] = Field(default_factory=list)
    tool_results: list[dict[str, Any]] = Field(default_factory=list)
    messages: list[dict[str, Any]] = Field(default_factory=list)
    status: str = "completed"
    error: str | None = None
    session_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ReportRequest(BaseModel):
    subject: str
    report_type: str
    recipients: list[EmailStr]
    report_data: dict[str, Any]
    content_markdown: str | None = None

class ReportSendRequest(BaseModel):
    report_id: str

class ReportResponse(BaseModel):
    id: str
    status: str
    subject: str
    report_type: str
    generated_at: datetime
    recipients: list[EmailStr]
    pdf_path: str | None = None
    content_html: str | None = None
    sent_at: datetime | None = None
    error_message: str | None = None
    content_markdown: str | None = None


# Tool Execution Model
# 
# {
#     "name": "get_backup_metrics",
#     "args": {
#         "days": 30
#     },
#     "success": True,
#     "duration_ms": 245.3,
#     "result": {
#         "success_rate": 98.2
#     }
# }

# Agent Response Model
# 
# {
#     "request_id": "7f53f73e-0a9d-41c-bf4a-1f4d62d88956",
#     "question": "How healthy are backups?",
#     "answer": "Backups are healthy with a 98.2% success rate over the last 30 days.",
#     "tool_calls": [
#         {
#             "name": "get_backup_metrics",
#             "success": true,
#             "duration_ms": 245.3
#         }
#     ],
#     "tool_results": [
#         {
#             "success_rate": 98.2
#         }
#     ]
# }

# Conversation State Model
# Represents the full state of a chat session.
# Used for multi-turn conversations.
#
# {
#     "session_id": "session_123",
#     "request_id": "7f53f73e-0a9d-41c-bf4a-1f4d62d88956",
#     "question": "Show backup failures",
#     "messages": [
#         {
#             "role": "user",
#             "content": "Show backup failures"
#         },
#         {
#             "role": "assistant",
#             "content": "There were 12 failed backups."
#         }
#     ],
#     "tool_calls": [...],
#     "tool_results": [...]
# }

# Agent State Model
# Internal working state while the agent is running.
# Passed between nodes in LangGraph.
#
# {
#     "request_id": "7f53f73e-0a9d-41c-bf4a-1f4d62d88956",
#     "question": "Analyze backup health",
#     "answer": null,
#     "messages": [],
#     "tool_calls": [],
#     "tool_results": []
# }

# Investigation Record Model
# Permanent record stored in the database.
# Used for auditing, history, observability and reporting.
#
# {
#     "request_id": "7f53f73e-0a9d-41c-bf4a-1f4d62d88956",
#     "question": "Why are backups failing?",
#     "answer": "Most failures are caused by repository rate limits.",
#     "tool_calls": [...],
#     "tool_results": [...],
#     "messages": [...],
#     "status": "completed",
#     "error": null,
#     "session_id": "session_123",
#     "created_at": "2026-06-18T10:00:00Z",
#     "updated_at": "2026-06-18T10:00:04Z"
# }

# Report Request Model
# Request used to generate a report.
#
# {
#     "subject": "Weekly Backup Health Report",
#     "report_type": "weekly",
#     "recipients": [
#         "admin@example.com"
#     ],
#     "report_data": {
#         "total_backups": 1250,
#         "success_rate": 98.2
#     }
# }

# Report Response Model
# Generated report metadata.
#
# {
#     "id": "report_123",
#     "status": "generated",
#     "subject": "Weekly Backup Health Report",
#     "report_type": "weekly",
#     "generated_at": "2026-06-18T10:00:00Z",
#     "recipients": [
#         "admin@example.com"
#     ],
#     "pdf_path": "/reports/report_123.pdf",
#     "content_html": "<html>...</html>",
#     "content_markdown": "# Weekly Backup Health Report",
#     "sent_at": null,
#     "error_message": null
# }