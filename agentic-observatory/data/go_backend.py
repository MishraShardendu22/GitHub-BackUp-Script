from __future__ import annotations

import asyncio
import time
from typing import Any
import httpx
from config import settings
from utils.logging import get_current_request_id, logger
from utils.metrics import metrics


class GoBackendClient:
    """HTTP client for communicating with the Go backend service.

    Automatically attaches the X-Internal-Secret header, propagates X-Request-ID,
    enforces connection pool limits, and implements bounded exponential retries.
    """

    def __init__(self, internal_secret: str | None = None, base_url: str | None = None):
        self.base_url = (base_url or settings.GO_BACKEND_URL).rstrip("/")
        secret = internal_secret or settings.INTERNAL_SECRET
        if not secret:
            raise RuntimeError(
                "INTERNAL_SECRET is not configured in settings. "
                "GoBackendClient requires a valid internal shared secret."
            )
        self.internal_secret = secret
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.HTTP_TIMEOUT_SECONDS),
            limits=httpx.Limits(
                max_connections=settings.HTTP_POOL_MAX_CONNS,
                max_keepalive_connections=settings.HTTP_POOL_KEEPALIVE_CONNS,
            ),
            headers={"X-Internal-Secret": self.internal_secret},
        )

    async def get(self, endpoint: str, params: dict[str, Any] | None = None) -> Any:
        headers: dict[str, str] = {}
        req_id = get_current_request_id()
        if req_id:
            headers["X-Request-ID"] = req_id

        max_retries = 3
        backoff_factor = 0.2
        last_err: Exception | None = None

        for attempt in range(max_retries):
            start_time = time.time()
            try:
                response = await self.client.get(
                    f"{self.base_url}{endpoint}",
                    params=params,
                    headers=headers,
                )
                duration = time.time() - start_time
                metrics.record_external_api("go_backend", endpoint, duration, success=response.is_success)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                duration = time.time() - start_time
                metrics.record_external_api("go_backend", endpoint, duration, success=False)
                # Fail fast on 4xx client errors (never retry bad requests / auth failures)
                if 400 <= e.response.status_code < 500:
                    logger.error(f"Go backend client error {e.response.status_code} on {endpoint}: {e}")
                    raise
                # Retry 5xx server errors
                last_err = e
                if attempt < max_retries - 1:
                    sleep_time = backoff_factor * (2 ** attempt)
                    logger.warning(
                        f"Go backend 5xx on {endpoint}, retrying in {sleep_time:.2f}s "
                        f"(attempt {attempt + 1}/{max_retries})..."
                    )
                    await asyncio.sleep(sleep_time)
            except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
                duration = time.time() - start_time
                metrics.record_external_api("go_backend", endpoint, duration, success=False)
                last_err = e
                if attempt < max_retries - 1:
                    sleep_time = backoff_factor * (2 ** attempt)
                    logger.warning(
                        f"Go backend network error on {endpoint}, retrying in {sleep_time:.2f}s "
                        f"(attempt {attempt + 1}/{max_retries})..."
                    )
                    await asyncio.sleep(sleep_time)

        raise RuntimeError(
            f"Go backend request to {endpoint} failed after {max_retries} attempts: {last_err}"
        ) from last_err

    async def get_dashboard_stats(self) -> dict[str, Any]:
        return await self.get("/api/dashboard/stats")

    async def list_backups(self, page: int = 1, limit: int = 50) -> dict[str, Any]:
        return await self.get(
            "/api/backups",
            {"page": page, "limit": limit},
        )

    async def get_latest_backup(self) -> dict[str, Any]:
        return await self.get("/api/backups/latest")

    async def get_backup_details(self, backup_id: int) -> dict[str, Any]:
        return await self.get(f"/api/backups/{backup_id}")

    async def get_metrics(self, days: int = 30, page: int = 1, limit: int = 50) -> dict[str, Any]:
        return await self.get(
            "/api/metrics",
            {
                "days": days,
                "page": page,
                "limit": limit,
            },
        )

    async def list_analytics_history(self, page: int = 1, limit: int = 50) -> dict[str, Any]:
        return await self.get(
            "/api/analytics/history",
            {
                "page": page,
                "limit": limit,
            },
        )

    async def get_latest_analytics(self) -> dict[str, Any]:
        return await self.get("/api/analytics/latest")

    async def get_analytics_for_run(self, run_id: int) -> dict[str, Any]:
        return await self.get(f"/api/analytics/run/{run_id}")

    async def list_repos(self, page: int = 1, limit: int = 50) -> dict[str, Any]:
        return await self.get(
            "/api/repos",
            {
                "page": page,
                "limit": limit,
            },
        )

    async def list_logs(
        self,
        page: int = 1,
        limit: int = 100,
        level: str | None = None,
        run_id: int | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "page": page,
            "limit": limit,
        }

        if level:
            params["level"] = level

        if run_id:
            params["run_id"] = run_id

        return await self.get("/api/logs", params)

    async def list_backup_fixes(self) -> list[dict[str, Any]]:
        return await self.get("/api/backup-fixes")

    async def get_backup_fix_details(self, fix_id: int) -> dict[str, Any]:
        return await self.get(f"/api/backup-fixes/{fix_id}")


class _LazyGoBackendClient:
    """Wrapper that defers initialization until first access or allows explicit initialization."""

    def __init__(self):
        self._instance: GoBackendClient | None = None

    def _get_client(self) -> GoBackendClient:
        if self._instance is None:
            self._instance = GoBackendClient()
        return self._instance

    def __getattr__(self, name: str):
        return getattr(self._get_client(), name)


client = _LazyGoBackendClient()