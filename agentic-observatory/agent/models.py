from __future__ import annotations

import time
import httpx
from utils.logging import logger

# In-memory cache
_models_cache: list[dict] | None = None
_cache_timestamp: float = 0
_CACHE_TTL_SECONDS: float = 300  # 5 minutes

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"


async def fetch_free_text_models(force_refresh: bool = False) -> list[dict]:
    """Fetch free text-output models from OpenRouter with caching."""
    global _models_cache, _cache_timestamp

    now = time.monotonic()
    if (
        not force_refresh
        and _models_cache is not None
        and (now - _cache_timestamp) < _CACHE_TTL_SECONDS
    ):
        return _models_cache

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(OPENROUTER_MODELS_URL)
            response.raise_for_status()
            data = response.json()

        all_models = data.get("data", [])
        free_text_models = []

        for model in all_models:
            # Check text output support
            arch = model.get("architecture", {})
            output_modalities = arch.get("output_modalities", [])
            if "text" not in output_modalities:
                continue

            # Check free pricing (prompt and completion both "0")
            pricing = model.get("pricing", {})
            prompt_price = pricing.get("prompt", "1")
            completion_price = pricing.get("completion", "1")

            try:
                if float(prompt_price) != 0 or float(completion_price) != 0:
                    continue
            except (ValueError, TypeError):
                continue

            free_text_models.append({
                "id": model["id"],
                "name": model.get("name", model["id"]),
                "context_length": model.get("context_length", 0),
                "description": model.get("description", ""),
            })

        # Sort alphabetically by display name
        free_text_models.sort(key=lambda m: m["name"].lower())

        _models_cache = free_text_models
        _cache_timestamp = now

        logger.info(f"Fetched {len(free_text_models)} free text models from OpenRouter")
        return free_text_models

    except Exception as exc:
        logger.error(f"Failed to fetch OpenRouter models: {exc}")
        # Return stale cache if available
        if _models_cache is not None:
            logger.info("Returning stale cached models")
            return _models_cache
        return []


async def validate_model_id(model_id: str) -> bool:
    """Check if a model ID is in the current list of free models."""
    models = await fetch_free_text_models()
    return any(m["id"] == model_id for m in models)
