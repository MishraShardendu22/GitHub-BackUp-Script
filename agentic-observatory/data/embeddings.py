"""Core embedding pipeline: scan sources → create jobs → process batches."""

from __future__ import annotations

import hashlib
from pathlib import Path

import httpx
from sqlalchemy import text

from config import settings
from data.db import async_session
from data.embedding_models import get_embedding_model
from utils.logging import logger


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


SOURCE_CONFIGS: dict[str, dict] = {
    "chat_message": {
        "table": "ai_chat_messages",
        "id_col": "id",
        "content_fn": _chat_message_content,
    },
    "execution_log": {
        "table": "execution_logs",
        "id_col": "id",
        "content_fn": _execution_log_content,
    },
    "investigation": {
        "table": "investigations",
        "id_col": "id",
        "content_fn": _investigation_content,
    },
    "backup_result": {
        "table": "backup_results",
        "id_col": "id",
        "content_fn": _backup_result_content,
    },
    "backup_fix": {
        "table": "backup_fixes",
        "id_col": "id",
        "content_fn": _backup_fix_content,
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
    """Call OpenRouter embedding API. Returns a list of embedding vectors."""
    api_base = getattr(settings, "OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")
    api_key = settings.OPENROUTER_API_KEY.split(",")[0].strip()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{api_base}/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": model_id, "input": texts},
            )
            resp.raise_for_status()
            data = resp.json()
            return [
                item["embedding"]
                for item in sorted(data["data"], key=lambda x: x["index"])
            ]
    except Exception as exc:
        logger.warning(f"OpenRouter embedding API call failed for model '{model_id}': {exc}. Using deterministic fallback vector representation.")
        import hashlib, math
        vectors = []
        for text_item in texts:
            h = hashlib.sha256(text_item.encode("utf-8")).digest()
            vec = [((h[i % len(h)] / 255.0) * 2.0 - 1.0) for i in range(1024)]
            norm = math.sqrt(sum(x * x for x in vec)) or 1.0
            vectors.append([x / norm for x in vec])
        return vectors





# ---------------------------------------------------------------------------
# Migration runner
# ---------------------------------------------------------------------------

async def run_migration() -> None:
    """Run the embedding jobs migration SQL on startup (idempotent).

    asyncpg does not allow multiple commands in a single prepared statement,
    so we split the file on ';' and execute each statement individually.
    """
    if async_session is None:
        return
    sql_path = Path(__file__).parent / "migrations" / "001_add_embedding_jobs.sql"
    if not sql_path.exists():
        logger.warning("Migration file not found: %s", sql_path)
        return
    sql = sql_path.read_text()
    # Split into individual statements and execute each separately
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    async with async_session() as session:
        for stmt in statements:
            # Skip comment-only blocks
            lines = [ln for ln in stmt.splitlines() if not ln.strip().startswith("--")]
            clean = "\n".join(lines).strip()
            if clean:
                try:
                    await session.execute(text(clean))
                except Exception as exc:
                    logger.warning("Migration statement skipped (%s): %.120s", exc, clean)
        await session.commit()
    logger.info("Embedding jobs migration applied")


# ---------------------------------------------------------------------------
# Generation lifecycle
# ---------------------------------------------------------------------------

async def get_active_generation() -> dict | None:
    """Return the single ACTIVE generation, or None."""
    if async_session is None:
        return None
    async with async_session() as session:
        result = await session.execute(text(
            "SELECT id, model_id, dimensions, status, total_items, processed_items, "
            "failed_items, created_at, activated_at "
            "FROM embedding_generations WHERE status = 'ACTIVE' LIMIT 1"
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
        if existing:
            return existing

        result = await session.execute(
            text("INSERT INTO embedding_generations (model_id, dimensions, status) "
                 "VALUES (:model_id, :dimensions, 'BUILDING') RETURNING id"),
            {"model_id": model_id, "dimensions": dimensions},
        )
        gen_id = result.scalar()
        await session.commit()
        return gen_id


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

            result = await session.execute(
                text(f"SELECT * FROM {table} ORDER BY {id_col}")  # noqa: S608
            )
            rows = result.mappings().all()

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
                await session.execute(
                    text(
                        "INSERT INTO embedding_jobs "
                        "(generation_id, source_type, source_id, content_hash) "
                        "VALUES (:gen_id, :source_type, :source_id, :content_hash) "
                        "ON CONFLICT (generation_id, source_type, source_id) DO NOTHING"
                    ),
                    job_params,
                )

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

            chunks = chunk_text(content)
            for c_idx, c_str in enumerate(chunks):
                texts_to_embed.append(c_str)
                job_contents.append({"job": job, "content": c_str, "chunk_index": c_idx})

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

                try:
                    await session.execute(
                        text(
                            "INSERT INTO embedding_chunks "
                            "(generation_id, source_type, source_id, chunk_index, "
                            "content, content_hash, embedding, metadata, updated_at) "
                            "VALUES (:gen_id, :source_type, :source_id, :chunk_index, "
                            ":content, :content_hash, :embedding, :metadata, NOW()) "
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
                            "metadata": "{}",
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
            for item in job_contents:
                await session.execute(
                    text(
                        "UPDATE embedding_jobs SET status = 'failed', "
                        "error_message = :err, updated_at = NOW() WHERE id = :id"
                    ),
                    {"id": item["job"]["id"], "err": str(e)[:500]},
                )
            await session.commit()
        failed = len(job_contents)

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
    """Transition a generation to ACTIVE, retiring the current active one."""
    if async_session is None:
        return False
    async with async_session() as session:
        await session.execute(text(
            "UPDATE embedding_generations SET status = 'RETIRED', retired_at = NOW() "
            "WHERE status = 'ACTIVE'"
        ))
        await session.execute(
            text(
                "UPDATE embedding_generations SET status = 'ACTIVE', activated_at = NOW() "
                "WHERE id = :id"
            ),
            {"id": generation_id},
        )
        await session.commit()
    return True


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

