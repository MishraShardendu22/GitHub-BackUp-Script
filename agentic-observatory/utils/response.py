# Standardized response format for API endpoints
from __future__ import annotations

from typing import Any
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from utils.logging import get_current_request_id


def success_response(
    data: Any = None,
    message: str = "Success",
    status_code: int = 200,
    request_id: str | None = None,
) -> JSONResponse:
    req_id = request_id or get_current_request_id()
    content: dict[str, Any] = {
        "success": True,
        "message": message,
        "data": data,
    }
    if req_id:
        content["request_id"] = req_id

    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(content),
    )


def error_response(
    message: str = "Something went wrong",
    status_code: int = 500,
    code: str = "INTERNAL_ERROR",
    details: Any = None,
    request_id: str | None = None,
) -> JSONResponse:
    req_id = request_id or get_current_request_id()
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder({
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "details": details,
                "request_id": req_id,
            },
            # Top-level message for backward compatibility with frontend consumers
            "message": message,
            "data": None,
        }),
    )