"""Embedding and reranking model registry for OpenRouter.

Fetches live supported embedding and reranking models directly from OpenRouter APIs:
  - https://openrouter.ai/api/v1/models?output_modalities=embeddings
  - https://openrouter.ai/api/v1/models?output_modalities=rerank

Filters for free models (prompt & completion price == 0) with caching and resilient fallback.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
import httpx

from utils.logging import logger

OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/models?output_modalities=embeddings"
OPENROUTER_RERANK_URL = "https://openrouter.ai/api/v1/models?output_modalities=rerank"

_CACHE_TTL_SECONDS: float = 300  # 5 minutes
_embed_cache: list[dict] | None = None
_embed_cache_timestamp: float = 0
_rerank_cache: list[dict] | None = None
_rerank_cache_timestamp: float = 0


@dataclass(frozen=True, slots=True)
class EmbeddingModelInfo:
    """Embedding model metadata."""

    id: str
    name: str
    dimensions: int
    provider: str
    max_tokens: int = 8192


@dataclass(frozen=True, slots=True)
class RerankModelInfo:
    """Reranking model metadata."""

    id: str
    name: str
    provider: str


def _extract_provider(model_id: str) -> str:
    """Extract raw provider name from model ID."""
    if "/" in model_id:
        raw = model_id.split("/")[0]
        name_map = {
            "google": "Google",
            "openai": "OpenAI",
            "anthropic": "Anthropic",
            "nvidia": "NVIDIA",
            "liquid": "LiquidAI",
            "cohere": "Cohere",
            "deepseek": "DeepSeek",
            "meta": "Meta",
            "mistralai": "Mistral",
            "qwen": "Qwen",
            "jina": "Jina",
            "voyageai": "VoyageAI",
            "thenlper": "Thenlper",
            "intfloat": "Intfloat",
            "sentence-transformers": "Sentence Transformers",
            "baai": "BAAI",
            "perplexity": "Perplexity",
        }
        return name_map.get(raw.lower(), raw.capitalize())
    return "OpenRouter"


def _estimate_dimensions(model_id: str, description: str = "") -> int:
    """Infer dimension size from model ID or description."""
    mid = model_id.lower()
    desc = description.lower()

    if "1024" in desc or "1,024" in desc or "350m" in mid or "jina-embeddings-v3" in mid or "bge-m3" in mid:
        return 1024
    if "3072" in desc or "3-large" in mid:
        return 3072
    if "1536" in desc or "3-small" in mid or "ada-002" in mid:
        return 1536
    if "768" in desc or "base" in mid or "gemini" in mid:
        return 768
    if "384" in desc or "minilm" in mid:
        return 384
    if "2048" in desc or "1b" in mid or "nemotron" in mid:
        return 2048
    return 1024


# ---------------------------------------------------------------------------
# Fallback models in case of OpenRouter API timeout / offline status
# ---------------------------------------------------------------------------
_FALLBACK_EMBEDDINGS: list[dict] = [
    {
        "id": "liquid/lfm-2.5-embedding-350m:free",
        "name": "LiquidAI: LFM2.5-Embedding-350M (free)",
        "dimensions": 1024,
        "provider": "LiquidAI",
    },
    {
        "id": "nvidia/nemotron-3-embed-1b:free",
        "name": "NVIDIA: Nemotron 3 Embed 1B (free)",
        "dimensions": 2048,
        "provider": "NVIDIA",
    },
    {
        "id": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
        "name": "NVIDIA: Llama Nemotron Embed VL 1B V2 (free)",
        "dimensions": 2048,
        "provider": "NVIDIA",
    },
]

_FALLBACK_RERANKERS: list[dict] = [
    {
        "id": "qwen/qwen3-reranker-8b",
        "name": "Qwen: Qwen3 Reranker 8B",
        "provider": "Qwen",
    },
    {
        "id": "voyageai/rerank-2.5-lite",
        "name": "VoyageAI: rerank-2.5-lite",
        "provider": "VoyageAI",
    },
    {
        "id": "voyageai/rerank-2.5",
        "name": "VoyageAI: rerank-2.5",
        "provider": "VoyageAI",
    },
    {
        "id": "nvidia/llama-nemotron-rerank-vl-1b-v2:free",
        "name": "NVIDIA: Llama Nemotron Rerank VL 1B V2 (free)",
        "provider": "NVIDIA",
    },
    {
        "id": "cohere/rerank-4-pro",
        "name": "Cohere: Rerank 4 Pro",
        "provider": "Cohere",
    },
    {
        "id": "cohere/rerank-4-fast",
        "name": "Cohere: Rerank 4 Fast",
        "provider": "Cohere",
    },
    {
        "id": "cohere/rerank-v3.5",
        "name": "Cohere: Rerank v3.5",
        "provider": "Cohere",
    },
]


async def fetch_free_embedding_models(force_refresh: bool = False) -> list[dict]:
    """Fetch live embedding models from OpenRouter API with free pricing priority."""
    global _embed_cache, _embed_cache_timestamp

    now = time.monotonic()
    if not force_refresh and _embed_cache is not None and (now - _embed_cache_timestamp) < _CACHE_TTL_SECONDS:
        return _embed_cache

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(OPENROUTER_EMBEDDINGS_URL)
            resp.raise_for_status()
            data = resp.json().get("data", [])

        free_models = []
        other_models = []

        for m in data:
            mid = m.get("id", "")
            name = m.get("name", mid)
            pricing = m.get("pricing", {})
            prompt_p = pricing.get("prompt", "1")
            compl_p = pricing.get("completion", "1")
            description = m.get("description", "")
            dims = _estimate_dimensions(mid, description)
            provider = _extract_provider(mid)

            is_free = False
            try:
                is_free = float(prompt_p) == 0 and float(compl_p) == 0
            except (ValueError, TypeError):
                is_free = False

            # Model item payload
            item = {
                "id": mid,
                "name": name,
                "dimensions": dims,
                "provider": provider,
                "is_free": is_free,
            }

            if is_free or ":free" in mid:
                free_models.append(item)
            else:
                other_models.append(item)

        # Free models first, then sort by display name
        free_models.sort(key=lambda x: x["name"].lower())
        results = free_models if free_models else other_models[:10]

        _embed_cache = results
        _embed_cache_timestamp = now
        logger.info(f"Fetched {len(results)} embedding models from OpenRouter ({len(free_models)} free)")
        return results

    except Exception as exc:
        logger.error(f"Failed to fetch OpenRouter embedding models: {exc}")
        if _embed_cache:
            return _embed_cache
        return _FALLBACK_EMBEDDINGS


async def fetch_free_reranking_models(force_refresh: bool = False) -> list[dict]:
    """Fetch live reranking models from OpenRouter API."""
    global _rerank_cache, _rerank_cache_timestamp

    now = time.monotonic()
    if not force_refresh and _rerank_cache is not None and (now - _rerank_cache_timestamp) < _CACHE_TTL_SECONDS:
        return _rerank_cache

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(OPENROUTER_RERANK_URL)
            resp.raise_for_status()
            data = resp.json().get("data", [])

        free_models = []
        other_models = []

        for m in data:
            mid = m.get("id", "")
            name = m.get("name", mid)
            pricing = m.get("pricing", {})
            prompt_p = pricing.get("prompt", "1")
            compl_p = pricing.get("completion", "1")
            provider = _extract_provider(mid)

            is_free = False
            try:
                is_free = float(prompt_p) == 0 and float(compl_p) == 0
            except (ValueError, TypeError):
                is_free = False

            item = {
                "id": mid,
                "name": name,
                "provider": provider,
                "is_free": is_free,
            }

            if is_free or ":free" in mid:
                free_models.append(item)
            else:
                other_models.append(item)

        free_models.sort(key=lambda x: x["name"].lower())
        results = free_models if free_models else other_models

        _rerank_cache = results
        _rerank_cache_timestamp = now
        logger.info(f"Fetched {len(results)} reranking models from OpenRouter ({len(free_models)} free)")
        return results

    except Exception as exc:
        logger.error(f"Failed to fetch OpenRouter reranking models: {exc}")
        if _rerank_cache:
            return _rerank_cache
        return _FALLBACK_RERANKERS


async def get_embedding_model(model_id: str) -> EmbeddingModelInfo:
    """Look up embedding model info by ID."""
    models = await fetch_free_embedding_models()
    found = next((m for m in models if m["id"] == model_id), None)
    if found:
        return EmbeddingModelInfo(
            id=found["id"],
            name=found["name"],
            dimensions=found["dimensions"],
            provider=found["provider"],
        )
    provider = _extract_provider(model_id)
    dims = _estimate_dimensions(model_id)
    return EmbeddingModelInfo(
        id=model_id,
        name=model_id,
        dimensions=dims,
        provider=provider,
    )


async def get_reranking_model(model_id: str) -> RerankModelInfo:
    """Look up reranking model info by ID."""
    models = await fetch_free_reranking_models()
    found = next((m for m in models if m["id"] == model_id), None)
    if found:
        return RerankModelInfo(
            id=found["id"],
            name=found["name"],
            provider=found["provider"],
        )
    provider = _extract_provider(model_id)
    return RerankModelInfo(id=model_id, name=model_id, provider=provider)
