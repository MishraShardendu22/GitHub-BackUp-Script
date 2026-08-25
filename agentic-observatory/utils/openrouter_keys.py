"""OpenRouter Multi-Key Failover and Rotation Utility.

Allows configuring multiple comma-separated OpenRouter API keys in OPENROUTER_API_KEY.
Automatically rotates to backup keys upon 401 (invalid key), 402 (no credits), 429 (rate limit),
or transient API failures.
"""

from __future__ import annotations

import threading
from typing import Callable, TypeVar, Awaitable
from config.settings import settings
from utils.logging import logger

T = TypeVar("T")

_lock = threading.Lock()
_current_key_index = 0


def get_openrouter_api_keys() -> list[str]:
    """Parse and return the list of configured OpenRouter API keys."""
    raw_keys = settings.OPENROUTER_API_KEY or ""
    if not raw_keys:
        return []
    keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
    return keys


def get_active_openrouter_key() -> str:
    """Return the currently active OpenRouter API key."""
    keys = get_openrouter_api_keys()
    if not keys:
        return ""
    with _lock:
        global _current_key_index
        return keys[_current_key_index % len(keys)]


def get_next_openrouter_key() -> str:
    """Advance to and return the next OpenRouter API key in round-robin rotary order."""
    keys = get_openrouter_api_keys()
    if not keys:
        return ""
    if len(keys) == 1:
        return keys[0]
    with _lock:
        global _current_key_index
        _current_key_index = (_current_key_index + 1) % len(keys)
        return keys[_current_key_index]


def rotate_openrouter_key(failed_key: str | None = None, reason: str = "") -> str:
    """Rotate to the next available OpenRouter key when the current one fails."""
    keys = get_openrouter_api_keys()
    if not keys:
        return ""
    if len(keys) == 1:
        return keys[0]

    with _lock:
        global _current_key_index
        current_key = keys[_current_key_index % len(keys)]
        # If the failed key matches current key (or unspecified), rotate forward
        if failed_key is None or failed_key == current_key:
            _current_key_index = (_current_key_index + 1) % len(keys)
            new_key = keys[_current_key_index]
            masked_old = f"{current_key[:10]}...{current_key[-4:]}" if len(current_key) > 14 else "key"
            masked_new = f"{new_key[:10]}...{new_key[-4:]}" if len(new_key) > 14 else "key"
            logger.warning(
                "OpenRouter key failover triggered (%s): switching from %s to %s (key %d/%d)",
                reason or "error",
                masked_old,
                masked_new,
                _current_key_index + 1,
                len(keys),
            )
            return new_key
        return keys[_current_key_index % len(keys)]


async def execute_with_key_fallback(
    operation: Callable[[str], Awaitable[T]],
    max_key_rotations: int | None = None,
) -> T:
    """Execute an async operation with automatic OpenRouter key rotation on failure.

    `operation` is an async function that takes the current `api_key: str` as argument.
    """
    keys = get_openrouter_api_keys()
    if not keys:
        raise ValueError("OPENROUTER_API_KEY is not configured in settings")

    total_keys = len(keys)
    rotations_allowed = max_key_rotations if max_key_rotations is not None else total_keys
    last_exception: Exception | None = None

    for attempt in range(rotations_allowed):
        current_key = get_active_openrouter_key()
        try:
            return await operation(current_key)
        except Exception as exc:
            last_exception = exc
            exc_str = str(exc)
            
            # Check if this error warrants rotating the key
            should_rotate = any(
                code in exc_str
                for code in ("401", "402", "403", "429", "Unauthorized", "insufficient_quota", "credits", "rate_limit")
            ) or attempt < rotations_allowed - 1

            if should_rotate and total_keys > 1:
                rotate_openrouter_key(failed_key=current_key, reason=exc_str[:120])
            else:
                raise

    raise RuntimeError(
        f"All {total_keys} OpenRouter API keys failed: {last_exception}"
    ) from last_exception
