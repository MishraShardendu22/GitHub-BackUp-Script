import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Any

import httpx
from sqlalchemy import text
from pydantic import BaseModel, Field
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm

from config import settings
from data import client
from data.db import init_db, async_session
from data.persistence import persistence_store
from data.embedding_models import fetch_free_embedding_models, fetch_free_reranking_models
from data import embeddings as embedding_service
from data.search import hybrid_search
from agent import invoke_agent, stream_agent
from agent.models import fetch_free_text_models, validate_model_id
from agent.state import InvestigationRecord, ReportRequest, ReportSendRequest, ToolExecution
from utils.auth import authenticate_user, create_access_token, get_current_user, TokenResponse
from utils.logging import logger, set_current_request_id
from utils.metrics import metrics
from utils.reports import (
    REPORT_DIR,
    normalize_recipients,
    render_report_html,
    send_email,
)
from utils.response import success_response, error_response

_startup_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await embedding_service.run_migration()
    yield


app = FastAPI(
    title="Github Backup Observation Agent",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://github.mishrashardendu22.is-a.dev",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|.*\.vercel\.app|github\.mishrashardendu22\.is-a\.dev)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_and_metrics_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID") or f"req-{uuid.uuid4().hex[:12]}"
    token = set_current_request_id(req_id)
    start_time = time.time()

    try:
        response = await call_next(request)
        duration = time.time() - start_time
        metrics.record_http_request(request.method, request.url.path, response.status_code, duration)
        response.headers["X-Request-ID"] = req_id
        return response
    except Exception as exc:
        duration = time.time() - start_time
        metrics.record_http_request(request.method, request.url.path, 500, duration)
        logger.error(f"Unhandled exception in HTTP {request.method} {request.url.path}: {exc}", exc_info=True)
        raise exc
    finally:
        set_current_request_id(None)


from starlette.exceptions import HTTPException as StarletteHTTPException


@app.exception_handler(StarletteHTTPException)
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException | HTTPException):
    code = "HTTP_ERROR"
    if exc.status_code == 401:
        code = "UNAUTHORIZED"
    elif exc.status_code == 403:
        code = "FORBIDDEN"
    elif exc.status_code == 404:
        code = "NOT_FOUND"
    elif exc.status_code == 422:
        code = "VALIDATION_ERROR"
    elif exc.status_code == 429:
        code = "RATE_LIMITED"
    elif exc.status_code == 503:
        code = "SERVICE_UNAVAILABLE"

    return error_response(
        message=str(exc.detail),
        status_code=exc.status_code,
        code=code,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return error_response(
        message="Request validation failed",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="VALIDATION_ERROR",
        details=exc.errors(),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global uncaught exception: {exc}", exc_info=True)
    return error_response(
        message=f"Internal server error: {exc}",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="INTERNAL_ERROR",
    )


class ChatRequest(BaseModel):
    question: str
    session_id: str | None = None
    model: str | None = None


class CreateSessionRequest(BaseModel):
    id: str | None = None
    session_name: str | None = None
    metadata: dict | None = None


class RenameSessionRequest(BaseModel):
    session_name: str


class ConfirmRequest(BaseModel):
    confirm_id: str
    approve: bool


class StartGenerationRequest(BaseModel):
    model_id: str


class ProcessBatchRequest(BaseModel):
    generation_id: int
    batch_size: int | None = None


class SwitchModelRequest(BaseModel):
    model_id: str


class SearchRequest(BaseModel):
    query: str
    source_types: list[str] | None = None
    limit: int = 20
    rerank_model_id: str | None = None
    fts_weight: float = 0.3
    semantic_weight: float = 0.7


class ExecuteToolRequest(BaseModel):
    tool_name: str
    args: dict[str, Any] = Field(default_factory=dict)


@app.get("/health")
@app.get("/healthz")
async def health_check():
    """Liveness check endpoint."""
    return success_response(
        data={
            "status": "ok",
            "uptime_seconds": round(time.time() - _startup_time, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        message="Liveness check successful",
    )


@app.get("/ready")
@app.get("/readyz")
async def readiness_check():
    """Readiness check validating database, Go backend, and configuration."""
    components = {
        "database": "disconnected",
        "go_backend": "disconnected",
        "configuration": "valid",
    }
    is_ready = True

    # 1. Check Database
    if not async_session:
        is_ready = False
        components["database"] = "disconnected (no DATABASE_URL configured)"
    else:
        try:
            async with async_session() as session:
                start_db = time.time()
                res = await session.execute(text("SELECT 1"))
                metrics.record_db_query(time.time() - start_db)
                if res.scalar() == 1:
                    components["database"] = "connected"
        except Exception as e:
            is_ready = False
            components["database"] = f"error: {e}"

    # 2. Check Go Backend
    try:
        async with httpx.AsyncClient(timeout=2.0) as http_c:
            resp = await http_c.get(f"{settings.GO_BACKEND_URL}/health")
            if resp.is_success:
                components["go_backend"] = "connected"
            else:
                components["go_backend"] = f"status: {resp.status_code}"
                is_ready = False
    except Exception as e:
        is_ready = False
        components["go_backend"] = f"unreachable: {e}"

    # 3. Check Configuration
    if not settings.OPENROUTER_API_KEY:
        is_ready = False
        components["configuration"] = "missing OPENROUTER_API_KEY"

    if not is_ready:
        return error_response(
            message="Readiness check failed",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="SERVICE_UNAVAILABLE",
            details=components,
        )

    return success_response(
        data={
            "status": "ready",
            "components": components,
            "uptime_seconds": round(time.time() - _startup_time, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        message="Readiness check successful",
    )


@app.get("/metrics")
async def get_metrics(format: str | None = None):
    """Exposes system metrics in Prometheus text exposition format or JSON."""
    if format == "json":
        return success_response(data=metrics.snapshot())
    return Response(
        content=metrics.prometheus_export(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@app.get("/test-backend")
async def test_backend():
    data = await client.get_dashboard_stats()
    return success_response(data=data)


@app.get("/api/models")
async def list_available_models():
    models = await fetch_free_text_models()
    if not models:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch available models from OpenRouter",
        )
    return success_response(data=models, message="Available free text models")


@app.post("/auth/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    if not authenticate_user(form_data.username, form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": form_data.username})
    return TokenResponse(access_token=access_token)


@app.post("/sessions")
async def create_session(request: CreateSessionRequest, current_user: str = Depends(get_current_user)):
    session = await persistence_store.create_session(
        session_id=request.id,
        session_name=request.session_name,
        metadata=request.metadata,
    )
    return success_response(data=session, message="Session created successfully")


@app.get("/sessions")
async def list_sessions(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    sessions = await persistence_store.list_sessions(limit=limit, offset=offset)
    return success_response(data=sessions, message="Sessions list retrieved")


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = await persistence_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return success_response(data=session, message="Session retrieved")


@app.patch("/sessions/{session_id}")
async def rename_session(
    session_id: str,
    request: RenameSessionRequest,
    current_user: str = Depends(get_current_user),
):
    session = await persistence_store.rename_session(session_id, request.session_name)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return success_response(data=session, message="Session renamed successfully")


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: str = Depends(get_current_user)):
    success = await persistence_store.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return success_response(data={"success": True}, message="Session deleted successfully")


@app.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    messages = await persistence_store.get_session_messages(session_id)
    return success_response(data=messages, message="Session messages retrieved")


@app.delete("/sessions/{session_id}/messages/{message_id}")
async def delete_session_message(
    session_id: str,
    message_id: str,
    current_user: str = Depends(get_current_user),
):
    await persistence_store.delete_session_message(session_id, message_id)
    return success_response(data={"success": True}, message="Message deleted successfully")


@app.get("/stats")
async def get_ai_stats():
    stats = await persistence_store.get_ai_dashboard_stats()
    return success_response(data=stats, message="AI Observatory stats retrieved")


@app.get("/chat")
async def chat_get(
    question: str = Query(..., description="Question for the agent"),
    session_id: str | None = Query(None, description="Optional chat session ID"),
    model: str | None = Query(None, description="OpenRouter model ID to use"),
    current_user: str = Depends(get_current_user),
):
    if session_id:
        await persistence_store.create_session(session_id=session_id)
        
    agent_response = await invoke_agent(question, session_id=session_id, model=model)
    
    user_msg = {"role": "user", "content": question, "created_at": datetime.now(timezone.utc).isoformat()}
    assistant_msg = {"role": "assistant", "content": agent_response.answer, "created_at": datetime.now(timezone.utc).isoformat()}
    
    investigation = InvestigationRecord(
        request_id=agent_response.request_id,
        session_id=session_id,
        question=agent_response.question,
        answer=agent_response.answer,
        tool_calls=agent_response.tool_calls,
        tool_results=agent_response.tool_results,
        messages=[user_msg, assistant_msg],
        status=agent_response.status,
    )
    await persistence_store.save_investigation(investigation)
    return success_response(
        data=agent_response.dict(),
        message="Chat response",
    )


@app.post("/chat")
async def chat(request: ChatRequest, current_user: str = Depends(get_current_user)):
    if request.session_id:
        await persistence_store.create_session(session_id=request.session_id)
        
    agent_response = await invoke_agent(request.question, session_id=request.session_id, model=request.model)
    
    user_msg = {"role": "user", "content": request.question, "created_at": datetime.now(timezone.utc).isoformat()}
    assistant_msg = {"role": "assistant", "content": agent_response.answer, "created_at": datetime.now(timezone.utc).isoformat()}
    
    investigation = InvestigationRecord(
        request_id=agent_response.request_id,
        session_id=request.session_id,
        question=request.question,
        answer=agent_response.answer,
        tool_calls=agent_response.tool_calls,
        tool_results=agent_response.tool_results,
        messages=[user_msg, assistant_msg],
        status=agent_response.status,
    )
    await persistence_store.save_investigation(investigation)
    return success_response(
        data=agent_response.dict(),
        message="Chat response",
    )


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest, current_user: str = Depends(get_current_user)):
    if request.session_id:
        await persistence_store.create_session(session_id=request.session_id)

    async def event_generator():
        answer_parts = []
        tool_calls = []
        tool_results = []
        request_id = None

        # async generator to stream events from the agent
        async for event_str in stream_agent(request.question, session_id=request.session_id, model=request.model):
            sse_token = event_str.replace("\n", "\ndata: ")
            yield f"data: {sse_token}\n\n"
            try:
                event = json.loads(event_str)
                if event["type"] == "info":
                    request_id = event["request_id"]
                elif event["type"] == "token":
                    answer_parts.append(event["text"])
                elif event["type"] == "tool_end":
                    tool_calls.append(ToolExecution(
                        name=event["name"],
                        success=event["success"],
                        duration_ms=event["duration_ms"],
                        args=event.get("args"),
                        error=event.get("error"),
                        result=event.get("result"),
                    ))
                    tool_results.append(event.get("result") or {})
            except Exception as e:
                logger.error(f"Error parsing stream event: {e}")

        # Save investigation record once stream finishes
        if request_id:
            answer = "".join(answer_parts)
            user_msg = {"role": "user", "content": request.question, "created_at": datetime.now(timezone.utc).isoformat()}
            assistant_msg = {"role": "assistant", "content": answer, "created_at": datetime.now(timezone.utc).isoformat()}
            investigation = InvestigationRecord(
                request_id=request_id,
                session_id=request.session_id,
                question=request.question,
                answer=answer,
                tool_calls=tool_calls,
                tool_results=tool_results,
                messages=[user_msg, assistant_msg],
                status="completed",
            )
            await persistence_store.save_investigation(investigation)

    # Return a streaming response that streams events to the client
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@app.post("/chat/confirm")
async def confirm_action(request: ConfirmRequest, current_user: str = Depends(get_current_user)):
    from agent.openrouter import active_confirmations, active_responses
    confirm_id = request.confirm_id
    if confirm_id not in active_confirmations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Confirmation ID not found or already processed."
        )
    
    active_responses[confirm_id] = request.approve
    active_confirmations[confirm_id].set()
    return success_response(
        data={"confirm_id": confirm_id, "approved": request.approve},
        message="Confirmation recorded successfully"
    )


@app.get("/investigations")
async def list_investigations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: str = Depends(get_current_user),
):
    records = await persistence_store.list_investigations(limit=limit, offset=offset)
    return success_response(data=records, message="Investigation list retrieved")


@app.get("/investigations/{request_id}")
async def get_investigation(
    request_id: str,
    current_user: str = Depends(get_current_user),
):
    record = await persistence_store.get_investigation(request_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")
    return success_response(data=record, message="Investigation retrieved")


@app.post("/reports")
async def create_report(
    request: ReportRequest,
    current_user: str = Depends(get_current_user),
):
    recipients = normalize_recipients([str(recipient) for recipient in request.recipients])
    html_content = render_report_html(request.report_type, request.report_data)
    pdf_path = None
    try:
        report = await persistence_store.save_report(
            report_type=request.report_type,
            subject=request.subject,
            recipients=recipients,
            content_html=html_content,
            content_markdown=request.content_markdown,
            status="generated",
        )
        output_dir = Path(REPORT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)
        if recipients:
            send_email(request.subject, recipients, html_content, attachments=[Path(pdf_path)] if pdf_path else None)
            report = await persistence_store.update_report_status(
                report_id=report["id"],
                status="sent",
                sent_at=datetime.now(timezone.utc),
                pdf_path=pdf_path,
            )
        return success_response(data=report, message="Report generated and sent")
    except Exception as exc:
        return success_response(data=None, message=f"Report creation failed: {str(exc)}")

@app.post("/reports/send")
async def send_saved_report(
    request: ReportSendRequest,
    current_user: str = Depends(get_current_user),
):
    report = await persistence_store.get_report(request.report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if not report.get("recipients"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Report has no recipients")
    try:
        send_email(
            report["subject"],
            report["recipients"],
            report["content_html"] or "",
        )
        updated = await persistence_store.update_report_status(
            report_id=request.report_id,
            status="sent",
            sent_at=datetime.now(timezone.utc),
        )
        return success_response(data=updated, message="Report emailed successfully")
    except Exception as exc:
        updated = await persistence_store.update_report_status(
            report_id=request.report_id,
            status="failed",
            error_message=str(exc),
        )
        return success_response(data=updated, message=f"Failed to send report: {str(exc)}")


class CreateFixRequest(BaseModel):
    title: str
    description: str = ""
    commitHash: str = ""
    author: str = ""
    affectedRuns: list[int]


@app.post("/backup-fixes", status_code=status.HTTP_201_CREATED)
async def create_backup_fix(
    request: CreateFixRequest,
    current_user: str = Depends(get_current_user),
):
    if not async_session:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database session factory is not configured."
        )

    # Perform database insertions inside a transaction
    async with async_session() as session:
        try:
            # 1. Insert into backup_fixes
            fix_query = text(
                """
                INSERT INTO backup_fixes (title, description, author, created_at, updated_at)
                VALUES (:title, :description, :author, NOW(), NOW())
                RETURNING id
                """
            )
            result = await session.execute(
                fix_query,
                {
                    "title": request.title,
                    "description": request.description or "",
                    "author": request.author or "",
                }
            )
            fix_id = result.scalar()
            if not fix_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create fix record"
                )

            # Insert commit hash if provided
            if request.commitHash and request.commitHash.strip():
                await session.execute(
                    text(
                        """
                        INSERT INTO backup_fix_commits (fix_id, commit_hash, created_at)
                        VALUES (:fix_id, :commit_hash, NOW())
                        ON CONFLICT (fix_id) DO UPDATE SET commit_hash = EXCLUDED.commit_hash
                        """
                    ),
                    {"fix_id": fix_id, "commit_hash": request.commitHash.strip()}
                )

            # 2. Insert mapping rows into backup_run_fixes
            for run_id in request.affectedRuns:
                # Verify run exists first
                run_exists = await session.execute(
                    text("SELECT id FROM backup_runs WHERE id = :run_id"),
                    {"run_id": run_id}
                )
                if not run_exists.scalar():
                    continue  # skip non-existent runs
                
                await session.execute(
                    text(
                        """
                        INSERT INTO backup_run_fixes (run_id, fix_id)
                        VALUES (:run_id, :fix_id)
                        ON CONFLICT DO NOTHING
                        """
                    ),
                    {"run_id": run_id, "fix_id": fix_id}
                )

            await session.commit()
            return {
                "id": fix_id,
                "message": "Fix logged successfully",
                "affectedRuns": request.affectedRuns
            }

        except HTTPException:
            await session.rollback()
            raise
        except Exception as e:
            await session.rollback()
            logger.error("Failed to create backup fix: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )


class UpdateFixRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    commitHash: str | None = None
    author: str | None = None
    affectedRuns: list[int] | None = None


@app.patch("/api/fixes/{fix_id}")
async def update_backup_fix(
    fix_id: int,
    request: UpdateFixRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update an existing manual fix and adjust its run associations.
    """
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    if not async_session:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database session factory is not configured."
        )

    async with async_session() as session:
        try:
            # Check if fix exists
            fix_check = await session.execute(
                text("SELECT f.id, f.title, f.description, COALESCE(bfc.commit_hash, ''), f.author FROM backup_fixes f LEFT JOIN backup_fix_commits bfc ON f.id = bfc.fix_id WHERE f.id = :fix_id"),
                {"fix_id": fix_id}
            )
            fix_row = fix_check.fetchone()
            if not fix_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Fix not found"
                )

            # Build UPDATE fields dynamic or check values
            title = request.title if request.title is not None else fix_row[1]
            description = request.description if request.description is not None else fix_row[2]
            commit_hash = request.commitHash if request.commitHash is not None else fix_row[3]
            author = request.author if request.author is not None else fix_row[4]

            # Update backup_fixes table
            update_query = text(
                """
                UPDATE backup_fixes
                SET title = :title, description = :description, author = :author, updated_at = NOW()
                WHERE id = :fix_id
                """
            )
            await session.execute(
                update_query,
                {
                    "fix_id": fix_id,
                    "title": title,
                    "description": description or "",
                    "author": author or "",
                }
            )

            # Update backup_fix_commits
            if commit_hash and commit_hash.strip():
                await session.execute(
                    text(
                        """
                        INSERT INTO backup_fix_commits (fix_id, commit_hash, created_at)
                        VALUES (:fix_id, :commit_hash, NOW())
                        ON CONFLICT (fix_id) DO UPDATE SET commit_hash = EXCLUDED.commit_hash
                        """
                    ),
                    {"fix_id": fix_id, "commit_hash": commit_hash.strip()}
                )
            else:
                await session.execute(
                    text("DELETE FROM backup_fix_commits WHERE fix_id = :fix_id"),
                    {"fix_id": fix_id}
                )

            # Update mapping rows in backup_run_fixes if affectedRuns is provided
            if request.affectedRuns is not None:
                # 1. Delete existing mappings for this fix
                await session.execute(
                    text("DELETE FROM backup_run_fixes WHERE fix_id = :fix_id"),
                    {"fix_id": fix_id}
                )

                # 2. Insert new mappings
                for run_id in request.affectedRuns:
                    # Verify run exists first
                    run_exists = await session.execute(
                        text("SELECT id FROM backup_runs WHERE id = :run_id"),
                        {"run_id": run_id}
                    )
                    if not run_exists.scalar():
                        continue  # skip non-existent runs
                    
                    await session.execute(
                        text(
                            """
                            INSERT INTO backup_run_fixes (run_id, fix_id)
                            VALUES (:run_id, :fix_id)
                            ON CONFLICT DO NOTHING
                            """
                        ),
                        {"run_id": run_id, "fix_id": fix_id}
                    )

            await session.commit()

            # Retrieve final affected runs
            affected_runs_result = await session.execute(
                text("SELECT run_id FROM backup_run_fixes WHERE fix_id = :fix_id"),
                {"fix_id": fix_id}
            )
            affected_runs = [r[0] for r in affected_runs_result.fetchall()]

            return {
                "id": fix_id,
                "title": title,
                "description": description,
                "commit_hash": commit_hash,
                "author": author,
                "affected_runs": affected_runs,
            }
        except HTTPException:
            raise
        except Exception as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database transaction failed: {str(exc)}"
            )


# =============================================================================
# Embedding & Search endpoints
# =============================================================================


@app.get("/api/embedding-models")
async def list_embedding_models():
    models = await fetch_free_embedding_models()
    return success_response(data=models, message="Available embedding models")


@app.get("/api/reranking-models")
async def list_reranking_models():
    models = await fetch_free_reranking_models()
    return success_response(data=models, message="Available reranking models")


@app.get("/api/tools")
async def list_agent_tools():
    """Lists all available agent tools with schemas and arguments."""
    from agent.openrouter import get_agent_tools
    tools = get_agent_tools()
    tool_list = []
    for t in tools:
        args_schema = {}
        if hasattr(t, "args_schema") and t.args_schema:
            try:
                args_schema = (
                    t.args_schema.schema()
                    if hasattr(t.args_schema, "schema")
                    else t.args_schema.model_json_schema()
                )
            except Exception:
                args_schema = {}
        elif hasattr(t, "args"):
            args_schema = t.args

        tool_list.append({
            "name": t.name,
            "description": t.description or "",
            "args_schema": args_schema,
        })
    return success_response(data=tool_list, message="Available agent tools")


@app.post("/api/tools/execute")
async def execute_agent_tool(
    request: ExecuteToolRequest,
    current_user: str = Depends(get_current_user),
):
    """Directly invokes an agent tool for developer testing and playground experimentation."""
    from agent.openrouter import get_agent_tools
    tools = {t.name: t for t in get_agent_tools()}
    if request.tool_name not in tools:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool '{request.tool_name}' not found."
        )

    tool = tools[request.tool_name]
    start_t = time.time()
    try:
        if asyncio.iscoroutinefunction(getattr(tool, "_arun", None)) or asyncio.iscoroutinefunction(getattr(tool, "ainvoke", None)):
            res = await tool.ainvoke(request.args)
        else:
            res = await asyncio.to_thread(tool.invoke, request.args)

        dur_ms = round((time.time() - start_t) * 1000, 2)
        return success_response(
            data={
                "name": request.tool_name,
                "args": request.args,
                "success": True,
                "duration_ms": dur_ms,
                "result": res,
                "error": None,
            },
            message=f"Tool {request.tool_name} executed successfully",
        )
    except Exception as exc:
        dur_ms = round((time.time() - start_t) * 1000, 2)
        return success_response(
            data={
                "name": request.tool_name,
                "args": request.args,
                "success": False,
                "duration_ms": dur_ms,
                "result": None,
                "error": str(exc),
            },
            message=f"Tool {request.tool_name} execution failed",
        )



@app.post("/embeddings/start-generation")
async def start_embedding_generation(
    request: StartGenerationRequest,
    current_user: str = Depends(get_current_user),
):
    try:
        result = await embedding_service.start_generation(request.model_id)
        return success_response(data=result, message="Embedding generation started")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Failed to start generation: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to start generation: {e!s}")


@app.post("/embeddings/process-batch")
async def process_embedding_batch(
    request: ProcessBatchRequest,
    current_user: str = Depends(get_current_user),
):
    try:
        result = await embedding_service.process_batch(request.generation_id, request.batch_size)
        return success_response(data=result, message="Batch processed")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Batch processing failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {e!s}")


@app.get("/embeddings/status")
async def get_embedding_status(
    generation_id: int | None = Query(None),
    current_user: str = Depends(get_current_user),
):
    result = await embedding_service.get_generation_status(generation_id)
    if not result:
        return success_response(data=None, message="No embedding generations found")
    return success_response(data=result, message="Generation status retrieved")


@app.post("/embeddings/switch-model")
async def switch_embedding_model(
    request: SwitchModelRequest,
    current_user: str = Depends(get_current_user),
):
    try:
        result = await embedding_service.switch_model(request.model_id)
        return success_response(data=result, message="Model switch initiated")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Model switch failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Model switch failed: {e!s}")


@app.post("/embeddings/activate")
async def activate_embedding_generation(
    generation_id: int = Query(...),
    current_user: str = Depends(get_current_user),
):
    success = await embedding_service.activate_generation(generation_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to activate generation")
    return success_response(
        data={"generation_id": generation_id, "status": "ACTIVE"},
        message="Generation activated and previous generations pruned",
    )


@app.post("/embeddings/prune")
async def prune_stale_embeddings(
    current_user: str = Depends(get_current_user),
):
    result = await embedding_service.prune_stale_generations()
    return success_response(
        data=result,
        message="Stale embedding generations and failed jobs pruned",
    )



@app.post("/search")
async def search_embeddings(
    request: SearchRequest,
    current_user: str = Depends(get_current_user),
):
    result = await hybrid_search(
        query=request.query,
        source_types=request.source_types,
        limit=request.limit,
        fts_weight=request.fts_weight,
        semantic_weight=request.semantic_weight,
        rerank_model_id=request.rerank_model_id,
    )
    return success_response(data=result, message="Search results")
