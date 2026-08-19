from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Any


class MetricsCollector:
    """Thread-safe collector for runtime and API metrics."""

    def __init__(self):
        self._lock = threading.Lock()
        self._start_time = time.time()
        self._http_requests: dict[str, int] = defaultdict(int)
        self._http_latencies: dict[str, list[float]] = defaultdict(list)
        self._external_api_calls: dict[str, int] = defaultdict(int)
        self._external_api_latencies: dict[str, list[float]] = defaultdict(list)
        self._db_queries_count = 0
        self._db_queries_duration_sum = 0.0
        self._embedding_jobs_processed = 0
        self._embedding_jobs_failed = 0
        self._active_embedding_jobs = 0

    def record_http_request(self, method: str, path: str, status_code: int, duration_sec: float) -> None:
        key = f"{method}_{path}_{status_code}"
        path_key = f"{method}_{path}"
        with self._lock:
            self._http_requests[key] += 1
            # Keep sample window of last 1000 latencies per endpoint to prevent memory growth
            samples = self._http_latencies[path_key]
            if len(samples) >= 1000:
                samples.pop(0)
            samples.append(duration_sec)

    def record_external_api(self, service: str, operation: str, duration_sec: float, success: bool = True) -> None:
        key = f"{service}_{operation}_{'success' if success else 'failed'}"
        op_key = f"{service}_{operation}"
        with self._lock:
            self._external_api_calls[key] += 1
            samples = self._external_api_latencies[op_key]
            if len(samples) >= 500:
                samples.pop(0)
            samples.append(duration_sec)

    def record_db_query(self, duration_sec: float) -> None:
        with self._lock:
            self._db_queries_count += 1
            self._db_queries_duration_sum += duration_sec

    def record_embedding_job(self, count: int = 1, failed: bool = False) -> None:
        with self._lock:
            if failed:
                self._embedding_jobs_failed += count
            else:
                self._embedding_jobs_processed += count

    def set_active_embedding_jobs(self, count: int) -> None:
        with self._lock:
            self._active_embedding_jobs = count

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            avg_latencies = {}
            for k, samples in self._http_latencies.items():
                if samples:
                    avg_latencies[f"{k}_avg_sec"] = sum(samples) / len(samples)

            ext_latencies = {}
            for k, samples in self._external_api_latencies.items():
                if samples:
                    ext_latencies[f"{k}_avg_sec"] = sum(samples) / len(samples)

            avg_db = (
                self._db_queries_duration_sum / self._db_queries_count
                if self._db_queries_count > 0
                else 0.0
            )

            return {
                "uptime_seconds": time.time() - self._start_time,
                "http_requests_total": dict(self._http_requests),
                "http_avg_latencies": avg_latencies,
                "external_api_calls": dict(self._external_api_calls),
                "external_api_avg_latencies": ext_latencies,
                "db_queries_count": self._db_queries_count,
                "db_queries_avg_seconds": avg_db,
                "embedding_jobs_processed": self._embedding_jobs_processed,
                "embedding_jobs_failed": self._embedding_jobs_failed,
                "active_embedding_jobs": self._active_embedding_jobs,
            }

    def prometheus_export(self) -> str:
        lines: list[str] = []
        snap = self.snapshot()

        lines.append("# HELP app_uptime_seconds Application uptime in seconds")
        lines.append("# TYPE app_uptime_seconds gauge")
        lines.append(f"app_uptime_seconds {snap['uptime_seconds']:.2f}\n")

        lines.append("# HELP http_requests_total Total HTTP requests")
        lines.append("# TYPE http_requests_total counter")
        for key, val in snap["http_requests_total"].items():
            parts = key.split("_")
            if len(parts) >= 3:
                method, path, status = parts[0], parts[1], parts[2]
                lines.append(f'http_requests_total{{method="{method}",path="{path}",status="{status}"}} {val}')
        lines.append("")

        lines.append("# HELP db_queries_total Total database queries executed")
        lines.append("# TYPE db_queries_total counter")
        lines.append(f"db_queries_total {snap['db_queries_count']}\n")

        lines.append("# HELP embedding_jobs_processed_total Total embedding jobs processed")
        lines.append("# TYPE embedding_jobs_processed_total counter")
        lines.append(f"embedding_jobs_processed_total {snap['embedding_jobs_processed']}\n")

        lines.append("# HELP embedding_jobs_failed_total Total embedding jobs failed")
        lines.append("# TYPE embedding_jobs_failed_total counter")
        lines.append(f"embedding_jobs_failed_total {snap['embedding_jobs_failed']}\n")

        lines.append("# HELP active_embedding_jobs Number of currently active embedding jobs")
        lines.append("# TYPE active_embedding_jobs gauge")
        lines.append(f"active_embedding_jobs {snap['active_embedding_jobs']}\n")

        return "\n".join(lines)


metrics = MetricsCollector()
