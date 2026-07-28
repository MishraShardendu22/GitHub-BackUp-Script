# Phase 1 Plan: GitHub-BackUp-Script (Canonical Design System Origin)

## 1. Design Intent
Establish a dark-mode only, high-density, engineering-grade design system for the GitHub Backup & Archival UI. The aesthetic must feel calm, intentional, and precise—reminiscent of GitHub Insights, Raycast, and Vercel dashboards.

## 2. Primitives & Token Architecture
Define a unified, CSS-variable-based token system in `src/app/styles/tokens.css` (imported by `globals.css`):
* **Colors (Dark-Mode Only)**:
  * `bg-base`: `#09090b` (Deep void background)
  * `bg-raised`: `#121318` (Card & panel surface)
  * `bg-overlay`: `#1c1d24` (Dropdowns, modals, hover states)
  * `border-default`: `#27272a` (Standard container borders)
  * `border-subtle`: `#1f1f23` (Subtle dividers)
  * `border-focus`: `#6366f1` (Focus rings & active borders)
  * `text-primary`: `#f4f4f5` (Headers, main metrics)
  * `text-secondary`: `#a1a1aa` (Labels, descriptions)
  * `text-muted`: `#71717a` (Timestamps, secondary metadata)
  * `accent`: `#6366f1` (Indigo brand accent)
  * `accent-muted`: `rgba(99, 102, 241, 0.15)`
  * `status-success`: `#10b981` (Emerald green)
  * `status-warning`: `#f59e0b` (Amber)
  * `status-danger`: `#ef4444` (Rose red)
  * `status-info`: `#3b82f6` (Sky blue)
* **Typography**:
  * Scale: `xs` (0.75rem / 12px), `sm` (0.875rem / 14px), `base` (1rem / 16px), `lg` (1.125rem / 18px), `xl` (1.25rem / 20px), `2xl` (1.5rem / 24px), `3xl` (1.875rem / 30px).
  * Monospace font family for commit SHA, repository sizes, execution duration, and log timestamps.
* **Spacing**:
  * Strict 4px grid system: `0.5` (2px), `1` (4px), `2` (8px), `3` (12px), `4` (16px), `6` (24px), `8` (32px), `12` (48px).
* **Radii & Elevation**:
  * Radii: `sm` (4px), `md` (6px), `lg` (8px), `xl` (12px), `full` (9999px).
  * Shadow: Subtle inset borders + low-opacity outer drop shadows.
* **Motion Tokens**:
  * `duration-fast`: `150ms ease-out`
  * `duration-normal`: `200ms ease-out`
  * Entrance curves: non-bouncy micro-fades and subtle scale transforms.

## 3. Concrete Component Upgrades
* **Buttons**: Standardize `Button` component with variants (`primary`, `secondary`, `ghost`, `destructive`), sizes (`sm`, `md`, `lg`), loading state spinner, and full keyboard focus accessibility.
* **Inputs & Controls**: Standardize search inputs, filter buttons, and dropdown select triggers with consistent border focus rings and clear buttons.
* **Cards & Panels**: Refactor `MetricCard`, backup run summary cards, and log panels to use unified semantic tokens instead of hardcoded hex values.
* **Tables**: Upgrade data tables in `/backups` and `/analytics` with clean row dividers, subtle hover highlights, sticky headers, and clear empty/loading skeletons.
* **Dialogs & Modals**: Ensure modals have backdrop overlay, focus trapping, Escape key listener, and accessible ARIA attributes.
* **Status Indicators & Badges**: Refactor `StatusBadge` and `ToolBadge` to use WCAG-compliant contrast backgrounds and semantic status colors.
* **Navigation**: Enhance `Sidebar` layout with collapsible state, active route indicator, aria-current="page", and tooltip previews.

## 4. Accessibility & SEO Upgrades
* Resolve all 63 Biome lint errors and 25 warnings.
* Fix non-interactive `<div>` click listeners by turning them into `<button>` elements with keyboard handlers (`onKeyDown`).
* Add `<title>` or `aria-label` to all SVGs.
* Enhance root metadata with OpenGraph, Twitter cards, and structured JSON-LD data for the backup tool.

## 5. Dependency Management
* No unnecessary new dependencies. Leverage Next 16, Lucide React, Clsx, and Recharts already installed.

## 6. Execution Plan
* Step 1: Token baseline creation (`src/app/styles/tokens.css`) & CSS cleanup.
* Step 2: UI Primitives refactoring (`src/components/ui/*`).
* Step 3: Layout & Navigation elevation (`src/components/layout/*`).
* Step 4: Page & Feature component enhancement (`/app`, `/components/backups`, `/components/analytics`, `/components/ai`).
* Step 5: Biome format & lint cleanup (`pnpm biome check --write`).
* Step 6: Validation (`pnpm build`, `pnpm lint`, `pnpm format`).
* Step 7: Git commit.
