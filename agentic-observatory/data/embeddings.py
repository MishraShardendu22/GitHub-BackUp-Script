"""Core embedding pipeline: scan sources → create jobs → process batches."""

from __future__ import annotations

import asyncio
import json
import hashlib
import time
from pathlib import Path

import httpx
from sqlalchemy import text

from config import settings
from data.db import async_session
from data.embedding_models import get_embedding_model
from utils.logging import logger
from utils.metrics import metrics


# ---------------------------------------------------------------------------
# Source type configuration — maps embedding source types to their tables
# and content extraction logic.
# ---------------------------------------------------------------------------

def _chat_message_content(row: dict) -> str:
    return row.get("content") or ""


def _execution_log_content(row: dict) -> str:
    parts = [f"[{row.get('level', 'info')}] {row.get('message', '')}"]
    if row.get("repository"):
        parts.append(f" (repo: {row['repository']})")
    return "".join(parts)


def _investigation_content(row: dict) -> str:
    question = row.get("question", "")
    answer = row.get("answer")
    if answer:
        return f"Q: {question}\nA: {answer}"
    return f"Q: {question}"


def _backup_result_content(row: dict) -> str:
    parts = [f"{row.get('repo_full_name', '')}: {row.get('status', '')}"]
    if row.get("error_message"):
        parts.append(f" error={row['error_message']}")
    return "".join(parts)


def _backup_fix_content(row: dict) -> str:
    parts = [f"{row.get('title', '')}: {row.get('description', '')}"]
    if row.get("author"):
        parts.append(f" (by {row['author']})")
    return "".join(parts)


def _chat_message_metadata(row: dict) -> dict:
    meta = {}
    if row.get("role"):
        meta["role"] = str(row["role"])
    if row.get("session_id"):
        meta["session_id"] = str(row["session_id"])
    if row.get("request_id"):
        meta["request_id"] = str(row["request_id"])
    return meta


def _execution_log_metadata(row: dict) -> dict:
    meta = {}
    if row.get("level"):
        meta["level"] = str(row["level"])
    if row.get("repository"):
        meta["repository"] = str(row["repository"])
    if row.get("run_id"):
        meta["run_id"] = row["run_id"]
    return meta


def _investigation_metadata(row: dict) -> dict:
    meta = {}
    if row.get("status"):
        meta["status"] = str(row["status"])
    if row.get("session_id"):
        meta["session_id"] = str(row["session_id"])
    if row.get("request_id"):
        meta["request_id"] = str(row["request_id"])
    return meta


def _backup_result_metadata(row: dict) -> dict:
    meta = {}
    if row.get("repo_full_name"):
        meta["repo"] = str(row["repo_full_name"])
    if row.get("status"):
        meta["status"] = str(row["status"])
    if row.get("run_id"):
        meta["run_id"] = row["run_id"]
    return meta


def _backup_fix_metadata(row: dict) -> dict:
    meta = {}
    if row.get("author"):
        meta["author"] = str(row["author"])
    if row.get("title"):
        meta["title"] = str(row["title"])
    return meta


SOURCE_CONFIGS: dict[str, dict] = {
    "chat_message": {
        "table": "ai_chat_messages",
        "id_col": "id",
        "content_fn": _chat_message_content,
        "metadata_fn": _chat_message_metadata,
    },
    "execution_log": {
        "table": "execution_logs",
        "id_col": "id",
        "content_fn": _execution_log_content,
        "metadata_fn": _execution_log_metadata,
    },
    "investigation": {
        "table": "investigations",
        "id_col": "id",
        "content_fn": _investigation_content,
        "metadata_fn": _investigation_metadata,
    },
    "backup_result": {
        "table": "backup_results",
        "id_col": "id",
        "content_fn": _backup_result_content,
        "metadata_fn": _backup_result_metadata,
    },
    "backup_fix": {
        "table": "backup_fixes",
        "id_col": "id",
        "content_fn": _backup_fix_content,
        "metadata_fn": _backup_fix_metadata,
    },
}


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def content_hash(content: str) -> str:
    """SHA-256 hex digest of content."""
    return hashlib.sha256(content.encode()).hexdigest()


def chunk_text(text_content: str, max_length: int = 500, overlap: int = 50) -> list[str]:
    """
    Sliding-window text chunking strategy.
    Splits long text records into overlapping chunks while preserving sentence/word boundaries.
    """
    if not text_content or not text_content.strip():
        return []
    clean_text = text_content.strip()
    if len(clean_text) <= max_length:
        return [clean_text]

    chunks: list[str] = []
    start = 0
    while start < len(clean_text):
        end = start + max_length
        if end < len(clean_text):
            last_break = max(clean_text.rfind("\n", start, end), clean_text.rfind(" ", start, end))
            if last_break > start + 100:
                end = last_break
        segment = clean_text[start:end].strip()
        if segment:
            chunks.append(segment)
        start = end - overlap if end < len(clean_text) else len(clean_text)

    return chunks or [clean_text]


async def embed_texts(texts: list[str], model_id: str) -> list[list[float]]:
    """Call OpenRouter embedding API with multi-key failover and exponential backoff.
    
    Returns a list of embedding vectors.
    """
    if not texts:
        return []

    from utils.openrouter_keys import get_openrouter_api_keys, get_active_openrouter_key, rotate_openrouter_key

    keys = get_openrouter_api_keys()
    if not keys:
        raise ValueError("OPENROUTER_API_KEY is not configured in settings")

    api_base = getattr(settings, "OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")
    total_keys = len(keys)
    last_err: Exception | None = None

    for key_attempt in range(total_keys):
        api_key = get_active_openrouter_key()
        max_retries = 3
        backoff_factor = 0.5

        for attempt in range(max_retries):
            start_time = time.time()
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{api_base}/embeddings",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json={"model": model_id, "input": texts},
                    )
                    duration = time.time() - start_time
                    metrics.record_external_api("openrouter", "embeddings", duration, success=resp.is_success)

                    if resp.status_code in (401, 402, 403, 429) and total_keys > 1 and key_attempt < total_keys - 1:
                        rotate_openrouter_key(failed_key=api_key, reason=f"HTTP {resp.status_code}")
                        break

                    resp.raise_for_status()
                    data = resp.json()
                    return [
                        item["embedding"]
                        for item in sorted(data["data"], key=lambda x: x["index"])
                    ]
            except httpx.HTTPStatusError as e:
                duration = time.time() - start_time
                metrics.record_external_api("openrouter", "embeddings", duration, success=False)
                if e.response.status_code in (401, 402, 403, 429) and total_keys > 1 and key_attempt < total_keys - 1:
                    rotate_openrouter_key(failed_key=api_key, reason=f"HTTP {e.response.status_code}")
                    break
                if e.response.status_code in (400, 404, 422):
                    logger.error("OpenRouter embedding error %d: %s", e.response.status_code, e.response.text)
                    raise
                last_err = e
                if attempt < max_retries - 1:
                    retry_after = e.response.headers.get("Retry-After")
                    sleep_time = float(retry_after) if retry_after else (backoff_factor * (2 ** attempt))
                    logger.warning(
                        "OpenRouter embedding %d on attempt %d/%d, retrying in %.2fs...",
                        e.response.status_code,
                        attempt + 1,
                        max_retries,
                        sleep_time,
                    )
                    await asyncio.sleep(sleep_time)
            except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
                duration = time.time() - start_time
                metrics.record_external_api("openrouter", "embeddings", duration, success=False)
                last_err = e
                if attempt < max_retries - 1:
                    sleep_time = backoff_factor * (2 ** attempt)
                    logger.warning(
                        "OpenRouter embedding network error on attempt %d/%d, retrying in %.2fs: %s",
                        attempt + 1,
                        max_retries,
                        sleep_time,
                        e,
                    )
                    await asyncio.sleep(sleep_time)

    raise RuntimeError(
        f"OpenRouter embedding request failed after trying all keys: {last_err}"
    ) from last_err





# ---------------------------------------------------------------------------
# Migration runner
# ---------------------------------------------------------------------------

async def run_migration() -> None:
    """Run all embedding and schema migration SQL files on startup (idempotent).

    asyncpg does not allow multiple commands in a single prepared statement,
    so we split each file on ';' and execute each statement individually.
    """
    if async_session is None:
        return
    migrations_dir = Path(__file__).parent / "migrations"
    if not migrations_dir.exists():
        logger.warning("Migrations directory not found: %s", migrations_dir)
        return

    sql_files = sorted(migrations_dir.glob("*.sql"))
    async with async_session() as session:
        for sql_path in sql_files:
            sql = sql_path.read_text()
            statements = [s.strip() for s in sql.split(";") if s.strip()]
            for stmt in statements:
                lines = [ln for ln in stmt.splitlines() if not ln.strip().startswith("--")]
                clean = "\n".join(lines).strip()
                if clean:
                    try:
                        await session.execute(text(clean))
                    except Exception as exc:
                        logger.warning("Migration statement skipped (%s): %.120s", exc, clean)
        await session.commit()
    logger.info("All database schema migrations applied")


# ---------------------------------------------------------------------------
# Generation lifecycle
# ---------------------------------------------------------------------------

async def get_active_generation() -> dict | None:
    """Return the single ACTIVE generation, or fallback to the latest generation with chunks."""
    if async_session is None:
        return None
    async with async_session() as session:
        # 1. Try to find the explicitly ACTIVE generation
        result = await session.execute(text(
            "SELECT id, model_id, dimensions, status, total_items, processed_items, "
            "failed_items, created_at, activated_at "
            "FROM embedding_generations WHERE status = 'ACTIVE' LIMIT 1"
        ))
        row = result.mappings().first()
        if row:
            return dict(row)

        # 2. Fallback to latest generation with processed chunks
        result = await session.execute(text(
            "SELECT id, model_id, dimensions, status, total_items, processed_items, "
            "failed_items, created_at, activated_at "
            "FROM embedding_generations WHERE processed_items > 0 ORDER BY id DESC LIMIT 1"
        ))
        row = result.mappings().first()
        if row:
            return dict(row)

        # 3. Fallback to any latest generation (e.g. BUILDING)
        result = await session.execute(text(
            "SELECT id, model_id, dimensions, status, total_items, processed_items, "
            "failed_items, created_at, activated_at "
            "FROM embedding_generations ORDER BY id DESC LIMIT 1"
        ))
        row = result.mappings().first()
        return dict(row) if row else None



async def get_or_create_generation(model_id: str, dimensions: int) -> int:
    """Get the BUILDING generation for this model, or create one."""
    if async_session is None:
        raise RuntimeError("Database not configured")
    async with async_session() as session:
        result = await session.execute(
            text("SELECT id FROM embedding_generations "
                 "WHERE model_id = :model_id AND status = 'BUILDING' LIMIT 1"),
            {"model_id": model_id},
        )
        existing = result.scalar()
        if existing is not None:
            return int(existing)

        result = await session.execute(
            text("INSERT INTO embedding_generations (model_id, dimensions, status) "
                 "VALUES (:model_id, :dimensions, 'BUILDING') RETURNING id"),
            {"model_id": model_id, "dimensions": dimensions},
        )
        gen_id = result.scalar()
        await session.commit()
        if gen_id is None:
            raise RuntimeError("Failed to create embedding generation")
        return int(gen_id)


# ---------------------------------------------------------------------------
# Scan & enqueue
# ---------------------------------------------------------------------------

async def scan_and_enqueue(generation_id: int) -> dict:
    """Scan all source tables and create embedding jobs for each record."""
    if async_session is None:
        raise RuntimeError("Database not configured")

    total_enqueued = 0
    stats: dict[str, int] = {}

    async with async_session() as session:
        for source_type, config in SOURCE_CONFIGS.items():
            table = config["table"]
            id_col = config["id_col"]
            content_fn = config["content_fn"]

            try:
                result = await session.execute(
                    text(f"SELECT * FROM {table} ORDER BY {id_col}")  # noqa: S608
                )
                rows = result.mappings().all()
            except Exception as e:
                logger.warning("Table %s not accessible for embedding scan: %s", table, e)
                continue

            job_params = []
            for row in rows:
                row_dict = dict(row)
                content = content_fn(row_dict)
                if not content or not content.strip():
                    continue
                source_id = str(row_dict[id_col])
                c_hash = content_hash(content)
                job_params.append({
                    "gen_id": generation_id,
                    "source_type": source_type,
                    "source_id": source_id,
                    "content_hash": c_hash,
                })

            if job_params:
                try:
                    await session.execute(
                        text(
                            "INSERT INTO embedding_jobs "
                            "(generation_id, source_type, source_id, content_hash) "
                            "VALUES (:gen_id, :source_type, :source_id, :content_hash) "
                            "ON CONFLICT (generation_id, source_type, source_id) DO NOTHING"
                        ),
                        job_params,
                    )
                except Exception as e:
                    logger.warning("Failed to insert embedding jobs for %s: %s", source_type, e)

            count = len(job_params)
            total_enqueued += count
            stats[source_type] = count

        await session.execute(
            text("UPDATE embedding_generations SET total_items = :total WHERE id = :gen_id"),
            {"total": total_enqueued, "gen_id": generation_id},
        )
        await session.commit()

    return {"total_enqueued": total_enqueued, "by_source": stats}



# ---------------------------------------------------------------------------
# Batch processing
# ---------------------------------------------------------------------------

async def process_batch(generation_id: int, batch_size: int | None = None) -> dict:
    """Claim and process a batch of embedding jobs. Returns processing stats."""
    if async_session is None:
        raise RuntimeError("Database not configured")
    batch_size = batch_size or 50

    # 1. Get generation info
    async with async_session() as session:
        gen_result = await session.execute(
            text("SELECT model_id, dimensions FROM embedding_generations WHERE id = :id"),
            {"id": generation_id},
        )
        gen_row = gen_result.mappings().first()
        if not gen_row:
            raise ValueError(f"Generation {generation_id} not found")
        model_id = gen_row["model_id"]

        # Reclaim stale jobs (stuck in 'processing' for >5 minutes)
        await session.execute(text(
            "UPDATE embedding_jobs SET status = 'pending', claimed_at = NULL, "
            "updated_at = NOW() "
            "WHERE status = 'processing' AND claimed_at < NOW() - INTERVAL '5 minutes'"
        ))

        # Claim a batch
        claim_result = await session.execute(
            text(
                "UPDATE embedding_jobs SET status = 'processing', "
                "attempt_count = attempt_count + 1, claimed_at = NOW(), updated_at = NOW() "
                "WHERE id IN ("
                "  SELECT id FROM embedding_jobs "
                "  WHERE generation_id = :gen_id "
                "    AND (status = 'pending' OR (status = 'failed' AND attempt_count < max_attempts)) "
                "  ORDER BY id LIMIT :batch_size FOR UPDATE SKIP LOCKED"
                ") RETURNING id, source_type, source_id, content_hash"
            ),
            {"gen_id": generation_id, "batch_size": batch_size},
        )
        jobs = [dict(r) for r in claim_result.mappings().all()]
        await session.commit()

    if not jobs:
        return {"processed": 0, "succeeded": 0, "failed": 0, "message": "No pending jobs"}

    # 2. Fetch content for each job
    texts_to_embed: list[str] = []
    job_contents: list[dict] = []

    async with async_session() as session:
        for job in jobs:
            source_type = job["source_type"]
            config = SOURCE_CONFIGS.get(source_type)
            if not config:
                await _fail_job(job["id"], f"Unknown source type: {source_type}")
                continue

            result = await session.execute(
                text(
                    f"SELECT * FROM {config['table']} "  # noqa: S608
                    f"WHERE {config['id_col']}::text = :source_id LIMIT 1"
                ),
                {"source_id": job["source_id"]},
            )
            row = result.mappings().first()
            if not row:
                await _fail_job(job["id"], "Source record not found")
                continue

            content = config["content_fn"](dict(row))
            if not content or not content.strip():
                await _fail_job(job["id"], "Empty content")
                continue

            metadata_fn = config.get("metadata_fn", lambda r: {})
            row_meta = metadata_fn(dict(row))

            chunks = chunk_text(content)
            for c_idx, c_str in enumerate(chunks):
                texts_to_embed.append(c_str)
                job_contents.append({
                    "job": job,
                    "content": c_str,
                    "chunk_index": c_idx,
                    "metadata": row_meta or {},
                })

    if not texts_to_embed:
        return {
            "processed": len(jobs),
            "succeeded": 0,
            "failed": len(jobs),
            "message": "No valid content found",
        }

    # 3. Call embedding API
    succeeded = 0
    failed = 0
    try:
        embeddings = await embed_texts(texts_to_embed, model_id)

        async with async_session() as session:
            for i, item in enumerate(job_contents):
                job = item["job"]
                content = item["content"]
                chunk_index = item["chunk_index"]
                embedding = embeddings[i]
                c_hash = content_hash(content)
                metadata_payload = item.get("metadata") or None
                metadata_str = json.dumps(metadata_payload) if metadata_payload else None

                try:
                    await session.execute(
                        text(
                            "INSERT INTO embedding_chunks "
                            "(generation_id, source_type, source_id, chunk_index, "
                            "content, content_hash, embedding, metadata, updated_at) "
                            "VALUES (:gen_id, :source_type, :source_id, :chunk_index, "
                            ":content, :content_hash, :embedding, CAST(:metadata AS jsonb), NOW()) "
                            "ON CONFLICT (generation_id, source_type, source_id, chunk_index) "
                            "DO UPDATE SET content = EXCLUDED.content, "
                            "content_hash = EXCLUDED.content_hash, "
                            "embedding = EXCLUDED.embedding, "
                            "metadata = EXCLUDED.metadata, updated_at = NOW()"
                        ),
                        {
                            "gen_id": generation_id,
                            "source_type": job["source_type"],
                            "source_id": job["source_id"],
                            "chunk_index": chunk_index,
                            "content": content,
                            "content_hash": c_hash,
                            "embedding": str(embedding),
                            "metadata": metadata_str,
                        },
                    )

                    await session.execute(
                        text(
                            "UPDATE embedding_jobs SET status = 'completed', "
                            "completed_at = NOW(), updated_at = NOW() WHERE id = :id"
                        ),
                        {"id": job["id"]},
                    )
                    succeeded += 1
                except Exception as e:
                    logger.error("Failed to store embedding for job %s: %s", job["id"], e)
                    await session.execute(
                        text(
                            "UPDATE embedding_jobs SET status = 'failed', "
                            "error_message = :err, updated_at = NOW() WHERE id = :id"
                        ),
                        {"id": job["id"], "err": str(e)[:500]},
                    )
                    failed += 1

            # Update generation counters
            await session.execute(
                text(
                    "UPDATE embedding_generations SET "
                    "processed_items = (SELECT COUNT(*) FROM embedding_jobs "
                    "  WHERE generation_id = :gen_id AND status = 'completed'), "
                    "failed_items = (SELECT COUNT(*) FROM embedding_jobs "
                    "  WHERE generation_id = :gen_id AND status = 'failed') "
                    "WHERE id = :gen_id"
                ),
                {"gen_id": generation_id},
            )
            await session.commit()
    except Exception as e:
        logger.error("Embedding API call failed: %s", e)
        async with async_session() as session:
            for job in jobs:
                await session.execute(
                    text(
                        "UPDATE embedding_jobs SET status = 'failed', "
                        "error_message = :err, updated_at = NOW() WHERE id = :id"
                    ),
                    {"id": job["id"], "err": str(e)[:500]},
                )
            await session.execute(
                text(
                    "UPDATE embedding_generations SET "
                    "processed_items = (SELECT COUNT(*) FROM embedding_jobs "
                    "  WHERE generation_id = :gen_id AND status = 'completed'), "
                    "failed_items = (SELECT COUNT(*) FROM embedding_jobs "
                    "  WHERE generation_id = :gen_id AND status = 'failed') "
                    "WHERE id = :gen_id"
                ),
                {"gen_id": generation_id},
            )
            await session.commit()
        failed = len(jobs)

    return {"processed": len(jobs), "succeeded": succeeded, "failed": failed}


async def _fail_job(job_id: int, message: str) -> None:
    """Mark a single job as failed."""
    if async_session is None:
        return
    async with async_session() as session:
        await session.execute(
            text(
                "UPDATE embedding_jobs SET status = 'failed', "
                "error_message = :err, updated_at = NOW() WHERE id = :id"
            ),
            {"id": job_id, "err": message},
        )
        await session.commit()


# ---------------------------------------------------------------------------
# Generation management
# ---------------------------------------------------------------------------

async def activate_generation(generation_id: int) -> bool:
    """Transition a generation to ACTIVE, demoting the previous active generation to RETIRED,
    and prune older retired/failed generations safely."""
    if async_session is None:
        return False
    async with async_session() as session:
        # 1. Demote any existing ACTIVE generation to RETIRED
        await session.execute(
            text(
                "UPDATE embedding_generations SET status = 'RETIRED', retired_at = NOW() "
                "WHERE status = 'ACTIVE' AND id != :id"
            ),
            {"id": generation_id},
        )
        # 2. Activate the specified generation
        await session.execute(
            text(
                "UPDATE embedding_generations SET status = 'ACTIVE', activated_at = NOW(), "
                "completed_at = COALESCE(completed_at, NOW()) "
                "WHERE id = :id"
            ),
            {"id": generation_id},
        )
        # 3. Transactionally delete older retired/failed generations (cascades deletion of old embedding_chunks & jobs)
        await session.execute(
            text(
                "DELETE FROM embedding_generations "
                "WHERE id != :id AND status IN ('RETIRED', 'FAILED')"
            ),
            {"id": generation_id},
        )
        await session.commit()
    return True


async def prune_stale_generations() -> dict[str, int]:
    """Delete all non-active retired/failed generations and stale failed jobs to save database storage."""
    if async_session is None:
        return {"deleted_generations": 0, "deleted_jobs": 0}
    async with async_session() as session:
        # 1. Delete all retired / failed generations (chunks and jobs cascade delete)
        gen_del = await session.execute(
            text("DELETE FROM embedding_generations WHERE status IN ('RETIRED', 'FAILED')")
        )
        del_gens = int(getattr(gen_del, "rowcount", 0) or 0)

        # 2. Delete stale jobs
        job_del = await session.execute(
            text("DELETE FROM embedding_jobs WHERE status = 'failed' AND updated_at < NOW() - INTERVAL '1 hour'")
        )
        del_jobs = int(getattr(job_del, "rowcount", 0) or 0)
        await session.commit()
    return {"deleted_generations": del_gens, "deleted_jobs": del_jobs}


async def start_generation(model_id: str) -> dict:
    """Start a new embedding generation: create it, scan sources, enqueue jobs."""
    model = await get_embedding_model(model_id)
    if not model:
        raise ValueError(f"Unknown embedding model: {model_id}")

    gen_id = await get_or_create_generation(model_id, model.dimensions)
    stats = await scan_and_enqueue(gen_id)

    return {
        "generation_id": gen_id,
        "model_id": model_id,
        "dimensions": model.dimensions,
        "status": "BUILDING",
        **stats,
    }


async def get_generation_status(generation_id: int | None = None) -> dict | None:
    """Get status of a generation (default: most recent)."""
    if async_session is None:
        return None
    async with async_session() as session:
        if generation_id:
            query = "SELECT * FROM embedding_generations WHERE id = :id"
            params: dict = {"id": generation_id}
        else:
            query = "SELECT * FROM embedding_generations ORDER BY created_at DESC LIMIT 1"
            params = {}
        result = await session.execute(text(query), params)
        gen = result.mappings().first()
        if not gen:
            return None
        gen_dict = dict(gen)

        job_result = await session.execute(
            text(
                "SELECT status, COUNT(*) as count FROM embedding_jobs "
                "WHERE generation_id = :gen_id GROUP BY status"
            ),
            {"gen_id": gen_dict["id"]},
        )
        job_counts = {row["status"]: row["count"] for row in job_result.mappings().all()}
        gen_dict["job_counts"] = job_counts
        return gen_dict


async def switch_model(new_model_id: str) -> dict:
    """Switch to a new embedding model. Creates new generation and schedules re-embedding."""
    model = await get_embedding_model(new_model_id)
    if not model:
        raise ValueError(f"Unknown embedding model: {new_model_id}")
    return await start_generation(new_model_id)

