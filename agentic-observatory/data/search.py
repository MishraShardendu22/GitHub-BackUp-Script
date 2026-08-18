"""Hybrid search: FTS + pgvector semantic search + RRF + optional reranking."""

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
    """
    if async_session is None:
        raise RuntimeError("Database not configured")

    # Get active generation
    active_gen = await get_active_generation()
    if not active_gen:
        return {"results": [], "message": "No active embedding generation. Start one first."}

    gen_id = active_gen["id"]
    model_id = active_gen["model_id"]

    # Embed the query
    query_embedding = None
    try:
        query_embeddings = await embed_texts([query], model_id)
        if query_embeddings:
            query_embedding = query_embeddings[0]
    except Exception as e:
        logger.warning("Query vector embedding unavailable (%s), using PostgreSQL Full-Text Search fallback", e)

    # Build optional source type filter
    type_filter = ""
    params: dict = {
        "gen_id": gen_id,
        "query": query,
        "fetch_limit": limit * 2,
    }
    if source_types:
        type_filter = "AND source_type = ANY(:source_types)"
        params["source_types"] = source_types

    fts_rows: list[dict] = []
    semantic_rows: list[dict] = []

    async with async_session() as session:
        # Full-text search
        fts_sql = f"""
            SELECT id, source_type, source_id, content, metadata,
                   ts_rank_cd(content_tsv, plainto_tsquery('english', :query)) AS fts_score
            FROM embedding_chunks
            WHERE generation_id = :gen_id
              AND content_tsv @@ plainto_tsquery('english', :query)
              {type_filter}
            ORDER BY fts_score DESC
            LIMIT :fetch_limit
        """
        fts_result = await session.execute(text(fts_sql), params)
        fts_rows = [dict(r) for r in fts_result.mappings().all()]

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
            semantic_result = await session.execute(text(semantic_sql), params)
            semantic_rows = [dict(r) for r in semantic_result.mappings().all()]



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

    # Optional reranking
    if rerank_model_id and results:
        rerank_info = await get_reranking_model(rerank_model_id)
        if rerank_info:
            try:
                results = await _rerank_results(query, results, rerank_model_id)
            except Exception as e:
                logger.error("Reranking failed, returning RRF results: %s", e)


    return {
        "results": results,
        "generation_id": gen_id,
        "model_id": model_id,
        "total": len(results),
    }


async def _rerank_results(
    query: str, results: list[dict], model_id: str
) -> list[dict]:
    """Rerank results using OpenRouter reranking API."""
    documents = [r["content"] for r in results]
    api_base = getattr(settings, "OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")
    api_key = settings.OPENROUTER_API_KEY.split(",")[0].strip()

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
