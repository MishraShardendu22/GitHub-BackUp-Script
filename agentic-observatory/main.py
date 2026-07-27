import json
from data import client
from pathlib import Path
from data.db import init_db, async_session
from sqlalchemy import text
from contextlib import asynccontextmanager
from utils.reports import (
    REPORT_DIR,
    normalize_recipients,
    render_report_html,
    send_email,
)
from datetime import datetime
from pydantic import BaseModel
from utils.response import success_response
from agent import invoke_agent, stream_agent
from agent.models import fetch_free_text_models, validate_model_id
from data.persistence import persistence_store
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from agent.state import InvestigationRecord, ReportRequest, ReportSendRequest, ToolExecution
from fastapi import Depends, FastAPI, HTTPException, Query, status
from utils.auth import authenticate_user, create_access_token, get_current_user, TokenResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Github Backup Observation Agent",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://github.mishrashardendu22.is-a.dev", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/health")
async def health_check():
    return success_response(
        data={"status": "ok"},
        message="Health check successful",
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
    
    user_msg = {"role": "user", "content": question, "created_at": datetime.utcnow().isoformat()}
    assistant_msg = {"role": "assistant", "content": agent_response.answer, "created_at": datetime.utcnow().isoformat()}
    
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
    
    user_msg = {"role": "user", "content": request.question, "created_at": datetime.utcnow().isoformat()}
    assistant_msg = {"role": "assistant", "content": agent_response.answer, "created_at": datetime.utcnow().isoformat()}
    
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
            user_msg = {"role": "user", "content": request.question, "created_at": datetime.utcnow().isoformat()}
            assistant_msg = {"role": "assistant", "content": answer, "created_at": datetime.utcnow().isoformat()}
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
                sent_at=datetime.utcnow(),
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
            sent_at=datetime.utcnow(),
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
                INSERT INTO backup_fixes (title, description, commit_hash, author, created_at, updated_at)
                VALUES (:title, :description, :commit_hash, :author, NOW(), NOW())
                RETURNING id
                """
            )
            result = await session.execute(
                fix_query,
                {
                    "title": request.title,
                    "description": request.description,
                    "commit_hash": request.commitHash,
                    "author": request.author,
                }
            )
            fix_id = result.scalar()
            if not fix_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create fix record"
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
                "title": request.title,
                "description": request.description,
                "commit_hash": request.commitHash,
                "author": request.author,
                "affected_runs": request.affectedRuns,
            }
        except Exception as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database transaction failed: {str(exc)}"
            )


class UpdateFixRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    commitHash: str | None = None
    author: str | None = None
    affectedRuns: list[int] | None = None


@app.put("/backup-fixes/{fix_id}")
async def update_backup_fix(
    fix_id: int,
    request: UpdateFixRequest,
    current_user: str = Depends(get_current_user),
):
    if not async_session:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database session factory is not configured."
        )

    async with async_session() as session:
        try:
            # Check if fix exists
            fix_check = await session.execute(
                text("SELECT id, title, description, commit_hash, author FROM backup_fixes WHERE id = :fix_id"),
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
                SET title = :title, description = :description, commit_hash = :commit_hash, author = :author, updated_at = NOW()
                WHERE id = :fix_id
                """
            )
            await session.execute(
                update_query,
                {
                    "fix_id": fix_id,
                    "title": title,
                    "description": description,
                    "commit_hash": commit_hash,
                    "author": author,
                }
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


