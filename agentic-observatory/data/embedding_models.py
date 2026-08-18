"""Embedding and reranking model registry for OpenRouter.

OpenRouter's /api/v1/models endpoint only lists chat/completion LLMs.
Embedding and reranking models are accessed via separate APIs and are
NOT returned by the general model listing endpoint.

This module maintains a curated list of models that OpenRouter actually
supports for embeddings and reranking, sourced from:
  https://openrouter.ai/docs/features/embeddings
  https://openrouter.ai/models?category=embed
  https://openrouter.ai/models?category=rerank
"""

from __future__ import annotations

from dataclasses import dataclass

from utils.logging import logger


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


# ---------------------------------------------------------------------------
# Curated embedding models supported by OpenRouter's /v1/embeddings API
# Source: https://openrouter.ai/models?category=embed
# ---------------------------------------------------------------------------
_EMBEDDING_MODELS: list[EmbeddingModelInfo] = [
    EmbeddingModelInfo(
        id="jina/jina-embeddings-v3",
        name="Jina: jina-embeddings-v3",
        dimensions=1024,
        provider="jina",
        max_tokens=8192,
    ),
    EmbeddingModelInfo(
        id="jina/jina-embeddings-v2-base-en",
        name="Jina: jina-embeddings-v2-base-en",
        dimensions=768,
        provider="jina",
        max_tokens=8192,
    ),
    EmbeddingModelInfo(
        id="jina/jina-colbert-v2",
        name="Jina: jina-colbert-v2",
        dimensions=128,
        provider="jina",
        max_tokens=8192,
    ),
    EmbeddingModelInfo(
        id="text-embedding-3-small",
        name="OpenAI: text-embedding-3-small",
        dimensions=1536,
        provider="openai",
        max_tokens=8191,
    ),
    EmbeddingModelInfo(
        id="text-embedding-3-large",
        name="OpenAI: text-embedding-3-large",
        dimensions=3072,
        provider="openai",
        max_tokens=8191,
    ),
    EmbeddingModelInfo(
        id="text-embedding-ada-002",
        name="OpenAI: text-embedding-ada-002",
        dimensions=1536,
        provider="openai",
        max_tokens=8191,
    ),
]

# ---------------------------------------------------------------------------
# Curated reranking models supported by OpenRouter's reranking API
# Source: https://openrouter.ai/models?category=rerank
# ---------------------------------------------------------------------------
_RERANKING_MODELS: list[RerankModelInfo] = [
    RerankModelInfo(
        id="jina/jina-reranker-v2-base-multilingual",
        name="Jina: jina-reranker-v2-base-multilingual",
        provider="jina",
    ),
    RerankModelInfo(
        id="jina/jina-reranker-v1-base-en",
        name="Jina: jina-reranker-v1-base-en",
        provider="jina",
    ),
    RerankModelInfo(
        id="cohere/rerank-english-v3.0",
        name="Cohere: rerank-english-v3.0",
        provider="cohere",
    ),
    RerankModelInfo(
        id="cohere/rerank-multilingual-v3.0",
        name="Cohere: rerank-multilingual-v3.0",
        provider="cohere",
    ),
    RerankModelInfo(
        id="cohere/rerank-english-v2.0",
        name="Cohere: rerank-english-v2.0",
        provider="cohere",
    ),
]


def _extract_provider(model_id: str) -> str:
    """Extract raw provider name from model ID."""
    if "/" in model_id:
        return model_id.split("/")[0]
    return "OpenRouter"


# ---------------------------------------------------------------------------
# Public API — async-friendly, matches the interface expected by main.py
# ---------------------------------------------------------------------------

async def fetch_free_embedding_models(force_refresh: bool = False) -> list[dict]:
    """Return the curated list of supported embedding models as dicts."""
    models = [
        {
            "id": m.id,
            "name": m.name,
            "dimensions": m.dimensions,
            "provider": m.provider,
        }
        for m in _EMBEDDING_MODELS
    ]
    logger.info("Returning %d supported embedding models", len(models))
    return models


async def fetch_free_reranking_models(force_refresh: bool = False) -> list[dict]:
    """Return the curated list of supported reranking models as dicts."""
    models = [
        {
            "id": m.id,
            "name": m.name,
            "provider": m.provider,
        }
        for m in _RERANKING_MODELS
    ]
    logger.info("Returning %d supported reranking models", len(models))
    return models


async def get_embedding_model(model_id: str) -> EmbeddingModelInfo | None:
    """Look up embedding model info by ID."""
    found = next((m for m in _EMBEDDING_MODELS if m.id == model_id), None)
    if found:
        return found
    # Unknown model — make a best-guess EmbeddingModelInfo so callers don't break
    provider = _extract_provider(model_id)
    dims = 768 if "google" in model_id.lower() else (1536 if "openai" in model_id.lower() else 1024)
    logger.warning("Unknown embedding model '%s', using dims=%d", model_id, dims)
    return EmbeddingModelInfo(
        id=model_id,
        name=model_id,
        dimensions=dims,
        provider=provider,
    )


async def get_reranking_model(model_id: str) -> RerankModelInfo | None:
    """Look up reranking model info by ID."""
    found = next((m for m in _RERANKING_MODELS if m.id == model_id), None)
    if found:
        return found
    provider = _extract_provider(model_id)
    logger.warning("Unknown reranking model '%s'", model_id)
    return RerankModelInfo(id=model_id, name=model_id, provider=provider)
