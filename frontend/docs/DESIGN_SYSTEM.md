# Systems Lab design system

The application uses a dark, operations-first visual language. The source of truth is the semantic token layer in `src/app/styles/base.css`; component primitives build on it in `src/app/styles/components.css`.

## Foundations

- **Typography:** Instrument Serif establishes hierarchy, Inter carries interface text, and IBM Plex Mono is reserved for system data and logs.
- **Spacing:** Work in the documented 8px scale (`--space-1` through `--space-6`). Use grid gaps before one-off margins.
- **Surfaces:** `--bg` is the application canvas, `--surface` and `--surface2` separate navigation and controls, and `--bg-card` is for grouped information.
- **Status colors:** Use `--success`, `--warning`, and `--danger` only for operational state. `--accent` is the navigational and interactive color.

## Reusable primitives

- Use `.card` for grouped content and `.card-flat` for nested metrics.
- Use `.stat-card`, `.stat-label`, and `.stat-value` for dashboard metrics.
- Use `.btn`, plus `btn-primary`, `btn-outline`, or `btn-ghost`, for actions. Use `.icon-button` for compact icon-only actions and always provide an accessible label.
- Use `StatusBadge` for run state, `EmptyState` for absent data, and `ErrorState` for recoverable client failures.
- Use `.table-wrap` with `.table` for data tables; it preserves horizontal access on small screens and a card layout on phones.

## Interaction requirements

- All interactive elements must show a visible keyboard focus ring.
- Motion must be informative and respect `prefers-reduced-motion`.
- Route loading, error, and not-found states are provided at the app boundary; new routes should preserve that experience.
- Keep data pages server-rendered. Add client components only for local interaction, streaming, or browser-only APIs.
