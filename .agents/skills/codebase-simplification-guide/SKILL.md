---
name: codebase-simplification-guide
description: >-
  Rules and principles for keeping this codebase clean, minimal, maintainable, and free of unnecessary abstractions.
---

# Codebase Simplification & Maintenance Guide

This skill provides guidelines on how to keep the repository clean, avoid over-engineering, and maintain high developer velocity.

---

## 1. Core Principles

1. **No Unwanted Infrastructure**:
   * Do not add Dockerfiles, docker-compose, Kubernetes manifests, Nginx configs, Prometheus/Grafana server setups, or Terraform scripts.
   * Everything runs on native Vercel (Next.js, Python FastAPI) and Render (Go Fiber).

2. **No Speculative Abstractions**:
   * Do not create interfaces or wrapper layers that have only a single implementation unless required for mocking in tests.
   * Prefer straightforward, readable standard library code over heavy external frameworks.

3. **Centralized Configuration**:
   * Never call `os.Getenv` or `process.env` in arbitrary component files.
   * All environment access must go through the dedicated central module (`backend/config`, `agentic-observatory/config`, `frontend/src/config/env.ts`).

4. **Zero Dead Code**:
   * Remove unused functions, structs, imports, scripts, and commented-out code during every refactoring pass.

5. **Safe Database Practices**:
   * Never drop or truncate production tables.
   * Always write idempotent migrations (`CREATE TABLE IF NOT EXISTS`).
