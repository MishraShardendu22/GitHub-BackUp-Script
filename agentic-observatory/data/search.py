"""Hybrid search: FTS + pgvector semantic search + RRF + optional reranking + direct source fallback."""

from __future__ import annotations

import httpx
from sqlalchemy import text

from config import settings
from data.db import async_session
from data.embeddings import embed_texts, get_active_generation
from data.embedding_models import get_reranking_model
from utils.logging import logger


async def hybrid_search(
    query: str,
    source_types: list[str] | None = None,
    limit: int = 20,
    fts_weight: float = 0.3,
    semantic_weight: float = 0.7,
    rerank_model_id: str | None = None,
) -> dict:
    """
    Execute a hybrid search combining PostgreSQL full-text search and
    pgvector semantic similarity, merged via Reciprocal Rank Fusion.
    Optionally re-rank the top results using a dedicated reranking model.
    Falls back to live source tables if chunk embeddings are pending or unindexed.
    """
    clean_query = query.strip()
    if not clean_query:
        return {"results": [], "total": 0, "message": "Empty search query"}

    if async_session is None:
        return {
            "results": [],
            "generation_id": None,
            "model_id": settings.OPENROUTER_MODEL,
            "total": 0,
            "message": "Database not configured",
        }

    # Get active or latest generation with chunks
    active_gen = await get_active_generation()
    gen_id = active_gen["id"] if active_gen else None
    model_id = active_gen["model_id"] if active_gen else settings.OPENROUTER_MODEL

    fts_rows: list[dict] = []
    semantic_rows: list[dict] = []

    if gen_id is not None:
        # Embed the query
        query_embedding = None
        try:
            query_embeddings = await embed_texts([clean_query], model_id)
            if query_embeddings:
                query_embedding = query_embeddings[0]
        except Exception as e:
            logger.warning("Query vector embedding unavailable (%s), using PostgreSQL Full-Text Search fallback", e)

        # Build optional source type filter
        type_filter = ""
        params: dict = {
            "gen_id": gen_id,
            "query": clean_query,
            "like_query": f"%{clean_query}%",
            "fetch_limit": limit * 2,
        }
        if source_types:
            type_filter = "AND source_type = ANY(:source_types)"
            params["source_types"] = source_types

        if async_session is not None:
            async with async_session() as session:
                # Full-text search + Substring fallback
                fts_sql = f"""
                    SELECT id, source_type, source_id, content, metadata,
                           COALESCE(ts_rank_cd(content_tsv, plainto_tsquery('english', :query)), 0.1) AS fts_score
                    FROM embedding_chunks
                    WHERE generation_id = :gen_id
                      AND (
                          content_tsv @@ plainto_tsquery('english', :query)
                          OR content ILIKE :like_query
                      )
                      {type_filter}
                    ORDER BY fts_score DESC
                    LIMIT :fetch_limit
                """
                try:
                    fts_result = await session.execute(text(fts_sql), params)
                    fts_rows = [dict(r) for r in fts_result.mappings().all()]
                except Exception as e:
                    logger.warning("FTS query failed: %s", e)

                # Vector semantic search (if query vector embedding is available)
                if query_embedding:
                    params["query_vec"] = str(query_embedding)
                    semantic_sql = f"""
                        SELECT id, source_type, source_id, content, metadata,
                               1 - (embedding <=> CAST(:query_vec AS vector)) AS semantic_score
                        FROM embedding_chunks
                        WHERE generation_id = :gen_id
                          AND embedding IS NOT NULL
                          {type_filter}
                        ORDER BY embedding <=> CAST(:query_vec AS vector)
                        LIMIT :fetch_limit
                    """
                    try:
                        semantic_result = await session.execute(text(semantic_sql), params)
                        semantic_rows = [dict(r) for r in semantic_result.mappings().all()]
                    except Exception as e:
                        logger.warning("Semantic vector query failed: %s", e)

    # Reciprocal Rank Fusion
    k = 60  # RRF smoothing constant
    scores: dict[int, dict] = {}

    for rank, row in enumerate(fts_rows):
        chunk_id = row["id"]
        rrf_score = fts_weight / (k + rank + 1)
        if chunk_id not in scores:
            scores[chunk_id] = {"data": row, "score": 0.0}
        scores[chunk_id]["score"] += rrf_score

    for rank, row in enumerate(semantic_rows):
        chunk_id = row["id"]
        rrf_score = semantic_weight / (k + rank + 1)
        if chunk_id not in scores:
            scores[chunk_id] = {"data": row, "score": 0.0}
        scores[chunk_id]["score"] += rrf_score

    ranked = sorted(scores.values(), key=lambda x: x["score"], reverse=True)[:limit]

    results = []
    for item in ranked:
        data = item["data"]
        results.append({
            "id": data["id"],
            "source_type": data["source_type"],
            "source_id": data["source_id"],
            "content": data["content"],
            "score": round(item["score"], 6),
            "metadata": data.get("metadata", {}),
        })

    # Direct source fallback if vector/FTS chunks yielded 0 results
    if not results and async_session is not None:
        async with async_session() as session:
            results = await _search_raw_sources(session, clean_query, source_types, limit)

    # Optional reranking
    if rerank_model_id and results:
        rerank_info = await get_reranking_model(rerank_model_id)
        if rerank_info:
            try:
                results = await _rerank_results(clean_query, results, rerank_model_id)
            except Exception as e:
                logger.error("Reranking failed, returning RRF results: %s", e)

    return {
        "results": results,
        "generation_id": gen_id,
        "model_id": model_id,
        "total": len(results),
    }


async def _search_raw_sources(
    session, query: str, source_types: list[str] | None, limit: int
) -> list[dict]:
    """Search live database tables directly as a robust fallback."""
    like_q = f"%{query}%"
    results: list[dict] = []

    # 1. execution_logs
    if not source_types or "execution_log" in source_types:
        try:
            res = await session.execute(
                text(
                    "SELECT id, level, message, repository, created_at "
                    "FROM execution_logs "
                    "WHERE message ILIKE :q OR repository ILIKE :q OR level ILIKE :q "
                    "ORDER BY id DESC LIMIT :limit"
                ),
                {"q": like_q, "limit": limit},
            )
            for row in res.mappings().all():
                d = dict(row)
                content = f"[{d.get('level', 'info')}] {d.get('message', '')}"
                if d.get("repository"):
                    content += f" (repo: {d['repository']})"
                results.append({
                    "id": d["id"],
                    "source_type": "execution_log",
                    "source_id": str(d["id"]),
                    "content": content,
                    "score": 0.85,
                    "metadata": {"repository": d.get("repository"), "level": d.get("level")},
                })
        except Exception as e:
            logger.debug("Raw search execution_logs skipped: %s", e)

    # 2. backup_results
    if not source_types or "backup_result" in source_types:
        try:
            res = await session.execute(
                text(
                    "SELECT r.id, r.repo_full_name, r.status, COALESCE(bre.error_message, '') AS error_message, r.commit_hash, r.created_at "
                    "FROM backup_results r "
                    "LEFT JOIN backup_result_errors bre ON r.id = bre.result_id "
                    "WHERE r.repo_full_name ILIKE :q OR r.status ILIKE :q OR bre.error_message ILIKE :q "
                    "ORDER BY r.id DESC LIMIT :limit"
                ),
                {"q": like_q, "limit": limit},
            )
            for row in res.mappings().all():
                d = dict(row)
                content = f"{d.get('repo_full_name', '')}: {d.get('status', '')}"
                if d.get("error_message"):
                    content += f" error={d['error_message']}"
                results.append({
                    "id": d["id"],
                    "source_type": "backup_result",
                    "source_id": str(d["id"]),
                    "content": content,
                    "score": 0.80,
                    "metadata": {"repo": d.get("repo_full_name"), "status": d.get("status")},
                })
        except Exception as e:
            logger.debug("Raw search backup_results skipped: %s", e)

    # 3. investigations
    if not source_types or "investigation" in source_types:
        try:
            res = await session.execute(
                text(
                    "SELECT id, request_id, question, answer, status, created_at "
                    "FROM investigations "
                    "WHERE question ILIKE :q OR answer ILIKE :q "
                    "ORDER BY created_at DESC LIMIT :limit"
                ),
                {"q": like_q, "limit": limit},
            )
            for row in res.mappings().all():
                d = dict(row)
                content = f"Q: {d.get('question', '')}\nA: {d.get('answer', '') or ''}"
                results.append({
                    "id": str(d["id"]),
                    "source_type": "investigation",
                    "source_id": str(d.get("request_id") or d["id"]),
                    "content": content,
                    "score": 0.90,
                    "metadata": {"status": d.get("status")},
                })
        except Exception as e:
            logger.debug("Raw search investigations skipped: %s", e)

    # 4. backup_fixes
    if not source_types or "backup_fix" in source_types:
        try:
            res = await session.execute(
                text(
                    "SELECT f.id, f.title, f.description, f.author, COALESCE(bfc.commit_hash, '') AS commit_hash, f.created_at "
                    "FROM backup_fixes f "
                    "LEFT JOIN backup_fix_commits bfc ON f.id = bfc.fix_id "
                    "WHERE f.title ILIKE :q OR f.description ILIKE :q OR f.author ILIKE :q "
                    "ORDER BY f.id DESC LIMIT :limit"
                ),
                {"q": like_q, "limit": limit},
            )
            for row in res.mappings().all():
                d = dict(row)
                content = f"{d.get('title', '')}: {d.get('description', '')}"
                if d.get("author"):
                    content += f" (by {d['author']})"
                results.append({
                    "id": d["id"],
                    "source_type": "backup_fix",
                    "source_id": str(d["id"]),
                    "content": content,
                    "score": 0.88,
                    "metadata": {"author": d.get("author")},
                })
        except Exception as e:
            logger.debug("Raw search backup_fixes skipped: %s", e)

    # 5. ai_chat_messages
    if not source_types or "chat_message" in source_types:
        try:
            res = await session.execute(
                text(
                    "SELECT id, role, content, request_id, created_at "
                    "FROM ai_chat_messages "
                    "WHERE content ILIKE :q "
                    "ORDER BY created_at DESC LIMIT :limit"
                ),
                {"q": like_q, "limit": limit},
            )
            for row in res.mappings().all():
                d = dict(row)
                results.append({
                    "id": str(d["id"]),
                    "source_type": "chat_message",
                    "source_id": str(d.get("request_id") or d["id"]),
                    "content": f"[{d.get('role', 'user')}]: {d.get('content', '')}",
                    "score": 0.75,
                    "metadata": {"role": d.get("role")},
                })
        except Exception as e:
            logger.debug("Raw search ai_chat_messages skipped: %s", e)

    return results[:limit]


async def _rerank_results(
    query: str, results: list[dict], model_id: str
) -> list[dict]:
    """Rerank results using OpenRouter reranking API with multi-key failover."""
    from utils.openrouter_keys import get_openrouter_api_keys, get_active_openrouter_key, rotate_openrouter_key

    documents = [r["content"] for r in results]
    api_base = getattr(settings, "OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")
    keys = get_openrouter_api_keys()

    if not keys:
        return results

    total_keys = len(keys)
    for key_attempt in range(total_keys):
        api_key = get_active_openrouter_key()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{api_base}/rerank",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model_id,
                        "query": query,
                        "documents": documents,
                    },
                )
                if resp.status_code in (401, 402, 403, 429) and total_keys > 1 and key_attempt < total_keys - 1:
                    rotate_openrouter_key(failed_key=api_key, reason=f"HTTP {resp.status_code}")
                    continue

                resp.raise_for_status()
                data = resp.json()

            reranked = []
            for item in sorted(
                data.get("results", []),
                key=lambda x: x.get("relevance_score", 0),
                reverse=True,
            ):
                idx = item["index"]
                if idx < len(results):
                    result = results[idx].copy()
                    result["score"] = round(item.get("relevance_score", 0), 6)
                    result["reranked"] = True
                    reranked.append(result)

            return reranked or results
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (401, 402, 403, 429) and total_keys > 1 and key_attempt < total_keys - 1:
                rotate_openrouter_key(failed_key=api_key, reason=f"HTTP {e.response.status_code}")
                continue
            logger.error("Reranking request failed with status %d: %s", e.response.status_code, e.response.text)
            break
        except Exception as e:
            logger.error("Reranking error: %s", e)
            break

    return results
