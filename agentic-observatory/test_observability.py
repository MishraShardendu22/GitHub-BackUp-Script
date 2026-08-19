import asyncio
import os
import unittest

os.environ.setdefault("GO_BACKEND_URL", "http://localhost:8080")
os.environ.setdefault("OPENROUTER_API_KEY", "test-key")
os.environ.setdefault("INTERNAL_SECRET", "test-secret")
os.environ.setdefault("JWT_SECRET", "test-jwt")

from httpx import AsyncClient, ASGITransport
from config.settings import Settings
from utils.logging import get_current_request_id, set_current_request_id
from utils.metrics import metrics
from utils.response import error_response, success_response
from main import app


class TestObservabilityAndHardening(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        os.environ["GO_BACKEND_URL"] = "http://localhost:8080"
        os.environ["OPENROUTER_API_KEY"] = "test-key"
        os.environ["INTERNAL_SECRET"] = "test-secret"
        os.environ["JWT_SECRET"] = "test-jwt"

    def test_settings_validation(self):
        # Valid settings
        s = Settings(
            GO_BACKEND_URL="http://localhost:8080",
            OPENROUTER_API_KEY="key",
            JWT_EXPIRES_MINUTES=60,
        )
        self.assertEqual(s.GO_BACKEND_URL, "http://localhost:8080")
        self.assertEqual(s.HTTP_POOL_MAX_CONNS, 50)

        # Invalid URL
        with self.assertRaises(ValueError):
            Settings(
                GO_BACKEND_URL="ftp://invalid",
                OPENROUTER_API_KEY="key",
            )

        # Invalid expiry
        with self.assertRaises(ValueError):
            Settings(
                GO_BACKEND_URL="http://localhost:8080",
                OPENROUTER_API_KEY="key",
                JWT_EXPIRES_MINUTES=-10,
            )

    def test_request_id_context(self):
        token = set_current_request_id("test-req-123")
        self.assertEqual(get_current_request_id(), "test-req-123")
        set_current_request_id(None)
        self.assertIsNone(get_current_request_id())

    def test_metrics_collector(self):
        metrics.record_http_request("GET", "/test", 200, 0.05)
        metrics.record_external_api("openrouter", "chat", 0.35, success=True)
        metrics.record_db_query(0.002)

        snap = metrics.snapshot()
        self.assertIn("GET_/test_200", snap["http_requests_total"])
        self.assertIn("openrouter_chat_success", snap["external_api_calls"])
        self.assertGreater(snap["db_queries_count"], 0)

        prom = metrics.prometheus_export()
        self.assertIn("http_requests_total", prom)
        self.assertIn("db_queries_total", prom)

    async def test_health_and_error_responses(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Health liveness
            res = await ac.get("/health")
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.headers.get("X-Request-ID"))
            data = res.json()
            self.assertTrue(data["success"])
            self.assertEqual(data["data"]["status"], "ok")

            # 2. Metrics endpoint
            res_m = await ac.get("/metrics")
            self.assertEqual(res_m.status_code, 200)
            self.assertIn("app_uptime_seconds", res_m.text)

            # 3. Standardized 404
            res_404 = await ac.get("/unknown-route")
            self.assertEqual(res_404.status_code, 404)
            data_404 = res_404.json()
            self.assertFalse(data_404["success"])
            self.assertEqual(data_404["error"]["code"], "NOT_FOUND")
            self.assertTrue(data_404["error"]["request_id"])

    def test_auth_token_lifecycle(self):
        from utils.auth import create_access_token
        from jose import jwt

        # Create valid token
        token = create_access_token(data={"sub": "admin_user"})
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
        self.assertEqual(payload["sub"], "admin_user")
        self.assertIn("exp", payload)

    def test_report_recipient_normalization(self):
        from utils.reports import normalize_recipients

        # Test string parsing
        recips = normalize_recipients("admin@example.com, test@domain.org; other@gbm.io")
        self.assertEqual(recips, ["admin@example.com", "test@domain.org", "other@gbm.io"])

        # Test list parsing
        recips_list = normalize_recipients(["one@test.com", "two@test.com"])
        self.assertEqual(recips_list, ["one@test.com", "two@test.com"])

    def test_text_chunking_and_hashing(self):
        from data.embeddings import chunk_text, content_hash

        text = "Hello world! This is a test."
        h = content_hash(text)
        self.assertEqual(len(h), 64)

        # Empty chunking
        self.assertEqual(chunk_text(""), [])

        # Small text chunking
        chunks = chunk_text("Short text", max_length=500)
        self.assertEqual(chunks, ["Short text"])

        # Long text chunking with overlap
        long_text = "Word " * 200
        long_chunks = chunk_text(long_text, max_length=100, overlap=20)
        self.assertGreater(len(long_chunks), 1)


if __name__ == "__main__":
    unittest.main()
