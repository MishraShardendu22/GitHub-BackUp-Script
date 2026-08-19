from __future__ import annotations

import contextvars
import json
import logging
import sys
from typing import Any

# ContextVar to store request ID across async tasks and handlers
request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)


def get_current_request_id() -> str | None:
    return request_id_var.get()


def set_current_request_id(req_id: str | None) -> contextvars.Token:
    return request_id_var.set(req_id)


class StructuredLogFilter(logging.Filter):
    """Injects request_id into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_current_request_id() or "-"
        return True


class JSONLogFormatter(logging.Formatter):
    """Formats log records as JSON."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


_handler = logging.StreamHandler(sys.stdout)
_handler.addFilter(StructuredLogFilter())
_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s | %(levelname)-5s | [%(request_id)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
)

logging.basicConfig(
    level=logging.INFO,
    handlers=[_handler],
)

logger = logging.getLogger("agentic-observatory")