# Phase 0 Audit: GitHub-BackUp-Script (Frontend)

## 1. Technical Stack & Rendering Model
* **Framework & Router**: Next.js `16.2.11` (App Router), React `19.2.8`.
* **Rendering Model**: SSR (Server-Side Rendering) with dynamic routes (`/ai/[id]`, `/analytics`, `/analytics/runs`, `/analytics/snapshots`, `/backups`, `/backups/[id]`) and static routes (`/`, `/live`, `/ai`).
* **Package Manager**: `pnpm` (pnpm-lock.yaml).
* **Build Tooling & TS Strictness**: Next Turbopack build, TypeScript `5.9.3` with strict mode enabled in `tsconfig.json`. Path alias `@/*` -> `./src/*`.
* **Linter & Formatter**: Biome `2.5.5` (`biome.json`).

## 2. Design Tokens & Styling Methodology
* **CSS System**: Tailwind CSS v4 (`@import "tailwindcss"`) supplemented by custom layer CSS files in `src/app/styles/` (`base.css`, `components.css`, `layout-grid.css`, `sidebar.css`, `ai.css`).
* **Current State**: Mixed token usage. Some CSS variables (`--background`, `--foreground`, `--card`, `--accent`) defined, but scattered hardcoded hex codes (`#F5E9D3`, `#111111`, `#09090b`, `#18181b`, `#27272a`) exist in CSS and inline JSX styles.

## 3. Component Architecture & Reusability
* **Primitives**: Primitive components exist in `src/components/ui/` (`MetricCard`, `StatusBadge`, `ToolBadge`, `EmptyState`, `ErrorState`, `LoadingState`, `SectionHeader`, `LoaderPanel`).
* **Feature Components**: Sectional components in `src/components/ai`, `analytics`, `backups`, `layout`, `live`.
* **Layout**: Navigation header + sidebar container (`SidebarLayout`).

## 4. Accessibility Posture (Baseline Gaps)
* Lack of keyboard navigation on custom interactive elements (e.g., `onClick` on static `<div>` in `ToolActivityBlock.tsx`).
* Missing `title` or `aria-label` attributes on standalone SVG icons (`ChevronIcon`, etc.).
* Missing focus visible styling on interactive buttons and tab controls.
* Some text contrast in secondary metrics requires WCAG AA validation.

## 5. SEO & Metadata
* Metadata configured in `layout.tsx` with title and description.
* Missing OpenGraph, Twitter card tags, structured data (e.g. SoftwareApplication schema), and proper favicon standard configurations.

## 6. Baseline Validation Status
* `pnpm build`: **PASS** (100% Turbopack compile success).
* `pnpm lint` / `biome check`: **63 Errors, 25 Warnings** (formatting, missing SVG titles, static click listeners, unorganized imports).

## 7. Product Purpose & Audience
* **Purpose**: Production-grade GitHub Backup & Repository Archival Engineering Dashboard.
* **Audience**: Systems engineers & DevOps specialists needing immediate visibility into backup status, metrics, storage usage, and AI agent execution logs.
* **Tone**: Technical, high-density, calm, minimal, precise.
