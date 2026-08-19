from __future__ import annotations

import uuid
from data.db import (
    ai_tool_calls,
    ai_tool_call_args,
    ai_tool_call_errors,
    ai_reports,
    async_session,
    investigations,
    investigation_errors,
    ai_chat_messages,
    ai_chat_sessions,
    ai_session_metadata,
)
from typing import Any
from config import settings
from datetime import datetime, timezone
from utils.logging import logger
from sqlalchemy.exc import SQLAlchemyError
from agent.state import InvestigationRecord
from fastapi.encoders import jsonable_encoder
from sqlalchemy import insert, select, update, delete, func, text

class PersistenceError(RuntimeError):
    pass

def parse_dt(val: Any) -> datetime:
    if not val:
        return datetime.now(timezone.utc)
    if isinstance(val, str):
        val = val.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(val)
        except Exception:
            return datetime.now(timezone.utc)
    if isinstance(val, datetime):
        return val
    return datetime.now(timezone.utc)

# This class is responsible for all interactions with the database related to investigations and reports. 
# basically filling the database tables with the data we want to store and also fetching that data when needed.
class InvestigationStore:
    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def _check(self):
        if self.session_factory is None:
            raise PersistenceError("Database is not configured. Set DATABASE_URL.")

    async def save_investigation(self, record: InvestigationRecord) -> dict[str, Any]:
        await self._check()
        payload = jsonable_encoder(record)
        try:
            async with self.session_factory() as session:
                session_id = payload.get("session_id")
                s_uuid = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
                req_uuid = uuid.UUID(payload["request_id"]) if isinstance(payload["request_id"], str) else payload["request_id"]
                inv_id = uuid.uuid4()

                await session.execute(
                    insert(investigations).values(
                        id=inv_id,
                        request_id=req_uuid,
                        session_id=s_uuid,
                        question=payload["question"],
                        answer=payload.get("answer"),
                        tool_calls=payload.get("tool_calls", []),
                        tool_results=payload.get("tool_results", []),
                        status=payload.get("status", "completed"),
                        created_at=parse_dt(payload.get("created_at")),
                        updated_at=parse_dt(payload.get("updated_at")),
                    )
                )

                err_msg = payload.get("error")
                if err_msg:
                    await session.execute(
                        insert(investigation_errors).values(
                            investigation_id=inv_id,
                            error=str(err_msg),
                            created_at=datetime.now(timezone.utc),
                        )
                    )

                tool_calls = payload.get("tool_calls", []) or []
                for tool_call in tool_calls:
                    tc_id = uuid.uuid4()
                    args_val = tool_call.get("args")
                    # Store args in dedicated normalized table if non-empty
                    if not args_val or args_val == {}:
                        args_val = None

                    err_val = tool_call.get("error")
                    if not err_val or err_val == "":
                        err_val = None

                    await session.execute(
                        insert(ai_tool_calls).values(
                            id=tc_id,
                            request_id=req_uuid,
                            name=tool_call.get("name"),
                            result=tool_call.get("result"),
                            success=tool_call.get("success", False),
                            duration_ms=tool_call.get("duration_ms"),
                            created_at=datetime.now(timezone.utc),
                        )
                    )

                    if args_val is not None:
                        await session.execute(
                            insert(ai_tool_call_args).values(
                                tool_call_id=tc_id,
                                args=args_val,
                            )
                        )

                    if err_val is not None:
                        await session.execute(
                            insert(ai_tool_call_errors).values(
                                tool_call_id=tc_id,
                                error=err_val,
                            )
                        )

                messages = payload.get("messages", []) or []
                for message in messages:
                    if not message:
                        continue
                    await session.execute(
                        insert(ai_chat_messages).values(
                            request_id=req_uuid,
                            session_id=s_uuid,
                            role=message.get("role"),
                            content=message.get("content"),
                            created_at=parse_dt(message.get("created_at")),
                        )
                    )

                await session.commit()
        except SQLAlchemyError as exc:
            logger.error(f"[request_id={record.request_id}] Failed to save investigation: {exc}")
            raise PersistenceError(str(exc)) from exc

        return payload

    async def get_investigation(self, request_id: str) -> dict[str, Any] | None:
        await self._check()
        async with self.session_factory() as session:
            result = await session.execute(
                select(investigations, investigation_errors.c.error)
                .outerjoin(investigation_errors, investigations.c.id == investigation_errors.c.investigation_id)
                .where(investigations.c.request_id == request_id)
            )
            row = result.mappings().first()
            return dict(row) if row else None

    async def list_investigations(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        await self._check()
        async with self.session_factory() as session:
            result = await session.execute(
                select(investigations, investigation_errors.c.error)
                .outerjoin(investigation_errors, investigations.c.id == investigation_errors.c.investigation_id)
                .order_by(investigations.c.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            return [dict(row) for row in result.mappings().all()]

    async def create_session(
        self,
        session_id: str | None = None,
        session_name: str | None = None,
        metadata: dict | None = None,
    ) -> dict[str, Any]:
        await self._check()
        now = datetime.now(timezone.utc)
        if session_id:
            s_id = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
        else:
            s_id = uuid.uuid4()
        name = session_name or f"New Chat {now.strftime('%Y-%m-%d %H:%M')}"
        async with self.session_factory() as session:
            # Check if session already exists
            existing = await session.execute(
                select(ai_chat_sessions).where(ai_chat_sessions.c.id == s_id)
            )
            row = existing.mappings().first()
            if row:
                res_dict = dict(row)
                meta_res = await session.execute(
                    select(ai_session_metadata.c.metadata)
                    .where(ai_session_metadata.c.session_id == s_id)
                )
                res_dict["metadata"] = meta_res.scalar() or {}
                return jsonable_encoder(res_dict)

            result = await session.execute(
                insert(ai_chat_sessions)
                .values(
                    id=s_id,
                    session_name=name,
                    created_at=now,
                    updated_at=now,
                )
                .returning(ai_chat_sessions)
            )

            # Insert into normalized ai_session_metadata table if metadata provided
            if metadata:
                await session.execute(
                    insert(ai_session_metadata).values(
                        id=uuid.uuid4(),
                        session_id=s_id,
                        metadata=metadata,
                        created_at=now,
                        updated_at=now,
                    )
                )

            await session.commit()
            created_row = result.mappings().first()
            res_dict = dict(created_row) if created_row else {}
            res_dict["metadata"] = metadata or {}
            return jsonable_encoder(res_dict)

    async def list_sessions(self, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        await self._check()
        async with self.session_factory() as session:
            result = await session.execute(
                select(
                    ai_chat_sessions.c.id,
                    ai_chat_sessions.c.session_name,
                    ai_chat_sessions.c.created_at,
                    ai_chat_sessions.c.updated_at,
                    ai_session_metadata.c.metadata,
                )
                .outerjoin(ai_session_metadata, ai_chat_sessions.c.id == ai_session_metadata.c.session_id)
                .order_by(ai_chat_sessions.c.updated_at.desc())
                .limit(limit)
                .offset(offset)
            )
            sessions_list = []
            for row in result.mappings().all():
                d = dict(row)
                d["metadata"] = d.get("metadata") or {}
                sessions_list.append(d)
            return jsonable_encoder(sessions_list)

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        await self._check()
        s_id = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
        async with self.session_factory() as session:
            result = await session.execute(
                select(ai_chat_sessions).where(ai_chat_sessions.c.id == s_id)
            )
            row = result.mappings().first()
            if not row:
                return None
            res_dict = dict(row)
            meta_res = await session.execute(
                select(ai_session_metadata.c.metadata)
                .where(ai_session_metadata.c.session_id == s_id)
            )
            res_dict["metadata"] = meta_res.scalar() or {}
            return jsonable_encoder(res_dict)

    async def rename_session(self, session_id: str, session_name: str) -> dict[str, Any] | None:
        await self._check()
        s_id = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
        async with self.session_factory() as session:
            result = await session.execute(
                update(ai_chat_sessions)
                .where(ai_chat_sessions.c.id == s_id)
                .values(session_name=session_name, updated_at=datetime.now(timezone.utc))
                .returning(ai_chat_sessions)
            )
            await session.commit()
            row = result.mappings().first()
            return jsonable_encoder(dict(row)) if row else None

    async def delete_session(self, session_id: str) -> bool:
        await self._check()
        s_id = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
        async with self.session_factory() as session:
            # Delete messages first
            await session.execute(
                delete(ai_chat_messages).where(ai_chat_messages.c.session_id == s_id)
            )
            # Update investigations session_id to Null
            await session.execute(
                update(investigations)
                .where(investigations.c.session_id == s_id)
                .values(session_id=None)
            )
            # Delete session
            await session.execute(
                delete(ai_chat_sessions).where(ai_chat_sessions.c.id == s_id)
            )
            await session.commit()
            return True

    async def get_session_messages(self, session_id: str) -> list[dict[str, Any]]:
        await self._check()
        s_id = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
        async with self.session_factory() as session:
            # Get messages
            messages_res = await session.execute(
                select(ai_chat_messages)
                .where(ai_chat_messages.c.session_id == s_id)
                .order_by(ai_chat_messages.c.created_at.asc())
            )
            message_rows = [dict(row) for row in messages_res.mappings().all()]
            if not message_rows:
                return []
            
            # Fetch all tool calls for these request IDs with left joins on normalized args and errors
            req_ids = [row["request_id"] for row in message_rows]
            tool_calls_stmt = (
                select(
                    ai_tool_calls.c.id,
                    ai_tool_calls.c.request_id,
                    ai_tool_calls.c.name,
                    ai_tool_calls.c.result,
                    ai_tool_calls.c.success,
                    ai_tool_calls.c.duration_ms,
                    ai_tool_call_args.c.args,
                    ai_tool_call_errors.c.error,
                )
                .select_from(
                    ai_tool_calls
                    .outerjoin(ai_tool_call_args, ai_tool_calls.c.id == ai_tool_call_args.c.tool_call_id)
                    .outerjoin(ai_tool_call_errors, ai_tool_calls.c.id == ai_tool_call_errors.c.tool_call_id)
                )
                .where(ai_tool_calls.c.request_id.in_(req_ids))
                .order_by(ai_tool_calls.c.created_at.asc())
            )
            tool_calls_res = await session.execute(tool_calls_stmt)
            tool_calls_rows = [dict(row) for row in tool_calls_res.mappings().all()]
            
            # Map tool calls to their request IDs
            tool_calls_by_req = {}
            for tc in tool_calls_rows:
                req_id = tc["request_id"]
                if req_id not in tool_calls_by_req:
                    tool_calls_by_req[req_id] = []
                tool_calls_by_req[req_id].append({
                    "name": tc["name"],
                    "args": tc.get("args") or {},
                    "result": tc["result"],
                    "success": tc["success"],
                    "duration_ms": tc["duration_ms"],
                    "error": tc.get("error")
                })
                
            # Populate messages with tool calls
            for msg in message_rows:
                # Convert created_at to isoformat string to make it JSON serializable safely
                if isinstance(msg.get("created_at"), datetime):
                    msg["created_at"] = msg["created_at"].isoformat()
                
                # Convert UUID fields to strings
                for uuid_field in ("id", "session_id", "request_id"):
                    if msg.get(uuid_field):
                        msg[uuid_field] = str(msg[uuid_field])
                
                if msg["role"] == "assistant":
                    msg["tool_calls"] = tool_calls_by_req.get(uuid.UUID(msg["request_id"]) if isinstance(msg["request_id"], str) else msg["request_id"], [])
                else:
                    msg["tool_calls"] = []
                    
            return jsonable_encoder(message_rows)

    async def get_ai_dashboard_stats(self) -> dict[str, Any]:
        await self._check()
        async with self.session_factory() as session:
            # 1. Total conversations
            sessions_count_stmt = select(func.count()).select_from(ai_chat_sessions)
            sessions_count_res = await session.execute(sessions_count_stmt)
            total_conversations = sessions_count_res.scalar() or 0

            # 2. Total agent runs (investigations)
            runs_count_stmt = select(func.count()).select_from(investigations)
            runs_count_res = await session.execute(runs_count_stmt)
            total_agent_runs = runs_count_res.scalar() or 0

            # 3. Success rate (completed investigations vs failed)
            success_count_stmt = select(func.count()).select_from(investigations).where(investigations.c.status == "completed")
            success_count_res = await session.execute(success_count_stmt)
            successful_runs = success_count_res.scalar() or 0
            success_rate = (successful_runs / total_agent_runs * 100) if total_agent_runs > 0 else 100.0

            # 4. Tool usage statistics
            tool_usage_stmt = select(
                ai_tool_calls.c.name,
                func.count().label("count"),
                func.avg(ai_tool_calls.c.duration_ms).label("avg_duration"),
                func.count().filter(ai_tool_calls.c.success == True).label("success_count")
            ).group_by(ai_tool_calls.c.name)
            tool_usage_res = await session.execute(tool_usage_stmt)
            tool_stats = []
            for row in tool_usage_res.mappings().all():
                row_dict = dict(row)
                row_dict["count"] = row_dict["count"] or 0
                row_dict["avg_duration"] = float(row_dict["avg_duration"]) if row_dict["avg_duration"] else 0.0
                row_dict["success_count"] = row_dict["success_count"] or 0
                row_dict["success_rate"] = (row_dict["success_count"] / row_dict["count"] * 100) if row_dict["count"] > 0 else 100.0
                tool_stats.append(row_dict)

            # 5. Memory statistics (number of messages stored)
            messages_count_stmt = select(func.count()).select_from(ai_chat_messages)
            messages_count_res = await session.execute(messages_count_stmt)
            total_messages = messages_count_res.scalar() or 0

            # 6. Recent activity (last 5 investigations)
            recent_activity_stmt = (
                select(investigations, investigation_errors.c.error)
                .outerjoin(investigation_errors, investigations.c.id == investigation_errors.c.investigation_id)
                .order_by(investigations.c.created_at.desc())
                .limit(5)
            )
            recent_activity_res = await session.execute(recent_activity_stmt)
            recent_activity = [dict(row) for row in recent_activity_res.mappings().all()]

            # 7. System health - check database health
            db_status = "healthy"
            try:
                await session.execute(text("SELECT 1"))
            except Exception:
                db_status = "unhealthy"

            return jsonable_encoder({
                "total_conversations": total_conversations,
                "total_agent_runs": total_agent_runs,
                "success_rate": round(success_rate, 2),
                "tool_usage": tool_stats,
                "memory_stats": {
                    "total_messages": total_messages,
                },
                "recent_activity": recent_activity,
                "system_health": {
                    "database": db_status,
                    "status": "operational" if db_status == "healthy" else "degraded"
                },
                "model_name": settings.OPENROUTER_MODEL
            })

    async def save_report(
        self,
        report_type: str,
        subject: str,
        recipients: list[str],
        content_html: str | None = None,
        content_markdown: str | None = None,
        status: str = "generated",
    ) -> dict[str, Any]:
        await self._check()
        report_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        async with self.session_factory() as session:
            await session.execute(
                insert(ai_reports).values(
                    id=report_id,
                    report_type=report_type,
                    subject=subject,
                    recipients=recipients,
                    content_html=content_html,
                    content_markdown=content_markdown,
                    status=status,
                    created_at=now,
                    updated_at=now,
                )
            )
            await session.commit()
            return {
                "id": str(report_id),
                "report_type": report_type,
                "subject": subject,
                "recipients": recipients,
                "content_html": content_html,
                "content_markdown": content_markdown,
                "status": status,
                "created_at": now.isoformat(),
            }

    async def get_report(self, report_id: str) -> dict[str, Any] | None:
        await self._check()
        r_id = uuid.UUID(report_id) if isinstance(report_id, str) else report_id
        async with self.session_factory() as session:
            result = await session.execute(
                select(ai_reports).where(ai_reports.c.id == r_id)
            )
            row = result.mappings().first()
            if not row:
                return None
            data = dict(row)
            if data.get("id"):
                data["id"] = str(data["id"])
            return jsonable_encoder(data)

    async def update_report_status(
        self,
        report_id: str,
        status: str,
        sent_at: datetime | None = None,
        pdf_path: str | None = None,
        error_message: str | None = None,
    ) -> dict[str, Any] | None:
        await self._check()
        r_id = uuid.UUID(report_id) if isinstance(report_id, str) else report_id
        values: dict[str, Any] = {
            "status": status,
            "updated_at": datetime.now(timezone.utc),
        }
        if sent_at is not None:
            values["sent_at"] = sent_at
        if pdf_path is not None:
            values["pdf_path"] = pdf_path
        if error_message is not None:
            values["error_message"] = error_message

        async with self.session_factory() as session:
            result = await session.execute(
                update(ai_reports)
                .where(ai_reports.c.id == r_id)
                .values(**values)
                .returning(ai_reports)
            )
            await session.commit()
            row = result.mappings().first()
            if not row:
                return None
            data = dict(row)
            if data.get("id"):
                data["id"] = str(data["id"])
            return jsonable_encoder(data)


persistence_store = InvestigationStore(async_session)