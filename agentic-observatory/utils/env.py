from __future__ import annotations

from typing import Any
from config.settings import Settings, settings

# Re-export singleton settings
__all__ = ["settings", "get_env", "get_config", "Settings"]


def get_config() -> Settings:
    """Return the centralized application configuration singleton."""
    return settings


def get_env(key: str, default: Any = None) -> Any:
    """Safely get a configuration value from the centralized settings object."""
    return getattr(settings, key, default)
