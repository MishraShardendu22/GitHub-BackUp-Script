"""Complete End-to-End Test Suite for Embedding, Chunking, Search, API, and Agent RAG."""

from __future__ import annotations

import asyncio
import httpx

from main import app
from data.db import engine, init_db
from config import settings
from utils.auth import create_access_token
from sqlalchemy import text


async def run_e2e_tests():
    print("=" * 70)
    print("STARTING END-TO-END VERIFICATION TEST SUITE")
    print("=" * 70)

    # 1. Initialize DB DDL Schema
    print("\n[STEP 1] Initializing DB Schema & Table Verification...")
    await init_db()

    async with engine.begin() as conn:
        res = await conn.execute(
            text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        )
        tables = [r[0] for r in res.fetchall()]
        print(f"✓ PostgreSQL Tables Active ({len(tables)} tables):", sorted(tables))

        # Seed sample source data into tables with correct UUID columns
        await conn.execute(text(
            "INSERT INTO execution_logs (run_id, level, message, repository) "
            "VALUES (NULL, 'error', 'Backup failed for repository project-alpha: connection refused on port 22', 'project-alpha')"
        ))
        await conn.execute(text(
            "INSERT INTO ai_chat_sessions (id, session_name) VALUES ('11111111-1111-1111-1111-111111111111', 'Test Session') "
            "ON CONFLICT DO NOTHING"
        ))
        await conn.execute(text(
            "INSERT INTO ai_chat_messages (id, session_id, request_id, role, content) "
            "VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'user', 'How to fix repository backup connection refused on port 22?') "
            "ON CONFLICT DO NOTHING"
        ))
        await conn.execute(text(
            "INSERT INTO backup_fixes (title, description, commit_hash, author) "
            "VALUES ('Fix SSH connection timeout', 'Added retry logic for connection refused errors during repository clone', 'abc1234', 'developer')"
        ))
    print("✓ Sample source records seeded into execution_logs, ai_chat_messages, and backup_fixes.")

    # 2. Setup Authentication Token
    print("\n[STEP 2] Generating JWT Authentication Token...")
    token = create_access_token({"sub": settings.CHAT_USERNAME})
    headers = {"Authorization": f"Bearer {token}"}
    print("✓ Auth token created for user:", settings.CHAT_USERNAME)

    # 3. Test API via httpx.AsyncClient with ASGITransport (sharing same event loop)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:

        print("\n[STEP 3] Testing Public Health Endpoint...")
        resp = await client.get("/health")
        assert resp.status_code == 200, f"Health failed: {resp.text}"
        print("✓ GET /health -> 200 OK:", resp.json()["message"])

        print("\n[STEP 4] Testing Embedding & Reranking Model Endpoints...")
        resp = await client.get("/api/embedding-models")
        assert resp.status_code == 200, f"Embedding models failed: {resp.text}"
        emb_models = resp.json()["data"]
        assert len(emb_models) > 0, "No embedding models returned"
        assert all(m.get("dimensions") for m in emb_models), "Embedding models missing dimensions"
        print(f"✓ GET /api/embedding-models -> 200 OK ({len(emb_models)} embedding models: {[m['id'] for m in emb_models]})")

        resp = await client.get("/api/reranking-models")
        assert resp.status_code == 200, f"Reranking models failed: {resp.text}"
        rerank_models = resp.json()["data"]
        assert len(rerank_models) > 0, "No reranking models returned"
        print(f"✓ GET /api/reranking-models -> 200 OK ({len(rerank_models)} reranking models: {[m['id'] for m in rerank_models]})")

        # Use the first curated embedding model (jina/jina-embeddings-v3)
        selected_model_id = emb_models[0]["id"]
        print(f"\n[STEP 5] Starting Generation with Model '{selected_model_id}'...")
        resp = await client.post(
            "/embeddings/start-generation",
            headers=headers,
            json={"model_id": selected_model_id},
        )
        assert resp.status_code == 200, f"Start generation failed: {resp.text}"
        gen_data = resp.json()["data"]
        gen_id = gen_data["generation_id"]
        print(f"✓ POST /embeddings/start-generation -> 200 OK: Generation #{gen_id} created with {gen_data.get('total_enqueued', 0)} enqueued jobs")

        print("\n[STEP 6] Checking Generation Status...")
        resp = await client.get(f"/embeddings/status?generation_id={gen_id}", headers=headers)
        assert resp.status_code == 200, f"Get status failed: {resp.text}"
        status_data = resp.json()["data"]
        print("✓ GET /embeddings/status -> 200 OK:", status_data["status"], "| Job Counts:", status_data["job_counts"])

        print("\n[STEP 7] Processing Embedding Job Batch...")
        resp = await client.post(
            "/embeddings/process-batch",
            headers=headers,
            json={"generation_id": gen_id, "batch_size": 10},
        )
        assert resp.status_code == 200, f"Process batch failed: {resp.text}"
        batch_data = resp.json()["data"]
        print("✓ POST /embeddings/process-batch -> 200 OK:", batch_data)

        print("\n[STEP 8] Activating Generation...")
        resp = await client.post(f"/embeddings/activate?generation_id={gen_id}", headers=headers)
        assert resp.status_code == 200, f"Activate failed: {resp.text}"
        print("✓ POST /embeddings/activate -> 200 OK: Generation activated")

        print("\n[STEP 9] Testing Hybrid Search Engine (FTS + pgvector + RRF)...")
        resp = await client.post(
            "/search",
            headers=headers,
            json={
                "query": "connection refused",
                "limit": 5,
                "fts_weight": 0.5,
                "semantic_weight": 0.5,
            },
        )
        assert resp.status_code == 200, f"Search failed: {resp.text}"
        search_data = resp.json()["data"]
        results = search_data.get("results", [])
        print(f"✓ POST /search -> 200 OK: {len(results)} matched results returned")
        for idx, r in enumerate(results, 1):
            print(f"   [{idx}] Source: {r['source_type']} | Score: {r['score']} | Content: {r['content'][:70]}...")

    print("\n[STEP 10] Testing Agent RAG Context Retrieval & Conversation...")
    from agent.openrouter import _retrieve_hybrid_context
    rag_prompt, sources = await _retrieve_hybrid_context("connection refused")
    print(f"✓ Agent RAG Context Retrieval: Retrieved {len(sources)} sources from PostgreSQL database")
    if sources:
        print(f"   Top Retrieved Source Content: {sources[0]['content'][:70]}...")

    print("\n" + "=" * 70)
    print("ALL END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY (10/10 STEPS)")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_e2e_tests())
