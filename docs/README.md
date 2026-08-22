# GitHub Backup Automation System — Documentation Index

This directory serves as the centralized technical documentation hub for developers, operators, and AI agents.

---

## Technical Documentation Sitemap

| Category | Document | Description |
| :--- | :--- | :--- |
| **System Architecture** | [`ARCHITECTURE.md`](ARCHITECTURE.md) | High-level system architecture, service breakdown, database schema, and deployment models. |
| **API Specification** | [`API_REFERENCE.md`](API_REFERENCE.md) | Comprehensive REST and WebSocket API endpoints, request/response schemas, and error codes. |
| **Pre-Commit Workflow** | [`PRECOMMIT_WORKFLOW.md`](PRECOMMIT_WORKFLOW.md) | Automated Git pre-commit validation gate, staged file filtering, and developer commands. |
| **Streaming Architecture** | [`STREAMING_ARCHITECTURE.md`](STREAMING_ARCHITECTURE.md) | SSE and WebSocket telemetry streams, event schemas, and proxy buffering guidelines. |
| **Postman API Suite** | [`POSTMAN_SETUP.md`](POSTMAN_SETUP.md) | Postman collection setup guide and testing workflows. |
| **Postman Artifacts** | [`postman/`](postman/) | Exported Postman JSON collection and environment definitions. |

---

## Core Repository Guides

* [Root README](../README.md): System overview, live demo links, and developer getting started guide.
* [Branching Policy](../BRANCHING.md): Branch creation conventions, hierarchical naming (`<user>/<parent>/<change>`), and lifecycle rules.
* [Repository Workflow](../WORKFLOW.md): Complete engineering lifecycle and explicit **Human-In-The-Loop Push Boundary**.
* [Agent Rules](../AGENTS.md): Operational boundaries and verification checklists for AI agents.
* [Agent Skills](../agents/README.md): Specialized runbooks and procedural skills for AI agents.
