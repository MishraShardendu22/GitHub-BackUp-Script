from __future__ import annotations

import uuid
from sqlalchemy import (
    JSON,
    text,
    Text,
    Table,
    Index,
    Float,
    String,
    Column,
    Boolean,
    MetaData,
    DateTime,
    ForeignKey,
)
from config import settings
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

# this file whereever meta data exists 
# we are running those and creating those tables and indexes
metadata = MetaData()

ai_chat_sessions = Table(
    "ai_chat_sessions",
    metadata,
    Column("id", PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
    Column("session_name", String, nullable=True),
    Column("metadata", JSONB, nullable=True),
)

ai_session_metadata = Table(
    "ai_session_metadata",
    metadata,
    Column("session_id", PG_UUID(as_uuid=True), ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), primary_key=True),
    Column("key", String, primary_key=True),
    Column("value", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
)
Index("idx_ai_session_metadata_session", ai_session_metadata.c.session_id)

ai_chat_messages = Table(
    "ai_chat_messages",
    metadata,
    Column("id", PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("session_id", PG_UUID(as_uuid=True), ForeignKey("ai_chat_sessions.id"), nullable=True),
    Column("request_id", PG_UUID(as_uuid=True), nullable=False),
    Column("role", String, nullable=False),
    Column("content", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
)
Index("idx_ai_chat_messages_request_id", ai_chat_messages.c.request_id)
Index("idx_ai_chat_messages_session_id", ai_chat_messages.c.session_id)

ai_tool_calls = Table(
    "ai_tool_calls",
    metadata,
    Column("id", PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("request_id", PG_UUID(as_uuid=True), nullable=False),
    Column("name", String, nullable=False),
    Column("args", JSONB, nullable=True),
    Column("result", JSONB, nullable=True),
    Column("success", Boolean, nullable=False, default=False),
    Column("duration_ms", Float, nullable=True),
    Column("error", Text, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
)
Index("idx_ai_tool_calls_request_id", ai_tool_calls.c.request_id)


investigations = Table(
    "investigations",
    metadata,
    Column("id", PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("request_id", PG_UUID(as_uuid=True), nullable=False, unique=True),
    Column("session_id", PG_UUID(as_uuid=True), ForeignKey("ai_chat_sessions.id"), nullable=True),
    Column("question", Text, nullable=False),
    Column("answer", Text, nullable=True),
    Column("tool_calls", JSONB, nullable=False, default=list),
    Column("tool_results", JSONB, nullable=False, default=list),
    Column("status", String, nullable=False, default="completed"),
    Column("error", Text, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
)
Index("idx_investigations_request_id", investigations.c.request_id)
Index("idx_investigations_session_id", investigations.c.session_id)
Index("idx_investigations_created_at", investigations.c.created_at)

ai_reports = Table(
    "ai_reports",
    metadata,
    Column("id", PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("report_type", String, nullable=False),
    Column("subject", String, nullable=False),
    Column("recipients", JSONB, nullable=False, default=list),
    Column("content_html", Text, nullable=True),
    Column("content_markdown", Text, nullable=True),
    Column("status", String, nullable=False, default="generated"),
    Column("pdf_path", String, nullable=True),
    Column("error_message", Text, nullable=True),
    Column("sent_at", DateTime(timezone=True), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
)
Index("idx_ai_reports_created_at", ai_reports.c.created_at)

def _normalise_url(url: str) -> tuple[str, dict]:
    """Rewrite the URL for asyncpg and return (clean_url, connect_args).

    asyncpg does not accept libpq-style query parameters such as
    ``sslmode``, ``channel_binding``, or ``sslrootcert``.  Strip them and
    translate ``sslmode=require`` / ``sslmode=verify-*`` to ``ssl=True``
    via connect_args instead.
    """
    from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

    # Rewrite the driver scheme first
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql+asyncpg://" + url[len(prefix):]
            break

    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    # Detect if SSL is wanted (sslmode=require / verify-ca / verify-full)
    sslmode = params.pop("sslmode", [None])[0]
    # channel_binding is a libpq-only concept – just drop it
    params.pop("channel_binding", None)
    # sslrootcert / sslcert / sslkey are also libpq-only – drop them
    for k in ("sslrootcert", "sslcert", "sslkey"):
        params.pop(k, None)

    # Rebuild URL without the removed params
    clean_query = urlencode(params, doseq=True)
    clean_url = urlunparse(parsed._replace(query=clean_query))

    connect_args: dict = {}
    if sslmode in ("require", "verify-ca", "verify-full"):
        connect_args["ssl"] = True

    return clean_url, connect_args


def _create_engine() -> AsyncEngine | None:
    db_url = settings.DATABASE_URL or settings.POSTGRES_URL
    if not db_url:
        return None
    url, connect_args = _normalise_url(db_url)
    return create_async_engine(
        url,
        future=True,
        echo=False,
        connect_args=connect_args,
    )

engine = _create_engine()
async_session = async_sessionmaker(engine, expire_on_commit=False) if engine else None

# wont override if already set
async def init_db() -> None:
    # if engine is None, it means DATABASE_URL is not set and we should skip database initialization
    if engine is None:
        return

    # 1. Create SQLAlchemy tables
    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all)

    # 2. Fast check: if embedding_chunks table exists, skip running raw DDL loop
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'embedding_chunks')"))
        exists = res.scalar()
        if exists:
            return

    # 3. Fallback: Execute schema.sql DDL statements if first run
    from pathlib import Path
    possible_paths = [
        Path(__file__).resolve().parent.parent.parent / "backend" / "db" / "schema.sql",
        Path("schema.sql"),
        Path("../backend/db/schema.sql"),
    ]
    schema_path = next((p for p in possible_paths if p.exists()), None)
    if schema_path:
        sql_content = schema_path.read_text()
        statements = [s.strip() for s in sql_content.split(";") if s.strip()]
        async with engine.begin() as conn:
            for stmt in statements:
                lines = [l for l in stmt.split("\n") if not l.strip().startswith("--")]
                clean_stmt = "\n".join(lines).strip()
                if clean_stmt:
                    try:
                        await conn.execute(text(clean_stmt))
                    except Exception:
                        pass


