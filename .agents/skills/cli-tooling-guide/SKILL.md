---
name: cli-tooling-guide
description: >-
  Standard operating guide for first-class authenticated CLI tools in the repository:
  GitHub CLI (gh), Google Jules CLI (jules), Vercel CLI (vercel), Neon CLI (neonctl), and Docker CLI (docker).
---

# Authenticated CLI Tooling & Operations Guide

This repository treats specialized developer CLI tools as first-class automation interfaces. AI agents and developers should prefer these authenticated CLIs over manual workflows:

---

## 1. Google Jules CLI (`jules`)
* **Purpose**: Asynchronous AI coding agent for automated multi-dimensional reviews, remote session generation, and code remediation.
* **Key Commands**:
  - `jules new "<task>"`: Create a new asynchronous task session.
  - `jules remote list --session`: List active remote coding sessions.
  - `jules remote pull --session <id> --apply`: Fetch and apply session patch locally.
  - `jules teleport <id>`: Switch workspace directly to session branch.
* **Script / Make Target**: `./scripts/jules-review-loop.sh`, `make jules-review`, `make jules-fix`.

---

## 2. GitHub CLI (`gh`)
* **Purpose**: PR creation, issue triage, label synchronization, CI status checks, and release management.
* **Key Commands**:
  - `gh pr create --base main --head <branch> --assignee "@me" --label "<labels>" --body "..."`
  - `gh pr checks <pr-number>`
  - `gh label create <name> --color <color> --description <desc> --force`

---

## 3. Neon PostgreSQL CLI (`neonctl`)
* **Purpose**: Database branching, schema isolation, migration validation, and compute endpoint management.

---

## 4. Vercel CLI (`vercel`)
* **Purpose**: Serverless deployment inspection for Frontend and Python Observatory.

---

## 5. Docker CLI (`docker`)
* **Purpose**: Multi-stage image build validation and local container runtime testing.
