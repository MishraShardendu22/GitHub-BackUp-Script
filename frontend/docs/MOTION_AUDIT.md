# Motion Audit: GitHub-BackUp-Script (Frontend)

## 1. Existing Motion Grep Analysis
* **Grep Hits**: 12 files reference CSS transitions/animations (mainly standard Tailwind `transition-colors` on buttons and sidebar items).
* **Missing Animations**: Page/route transitions, card grid entrance choreography, backup status metric counter animation, modal/drawer enter/exit, and skeleton shimmer states.

## 2. High-Value Targeted Additions
* **Library**: `framer-motion` / `motion` (Next.js client components).
* **Target Interactions**:
  1. Route & tab view transitions (fade + subtle 8px Y slide).
  2. Backup run card list entrance choreography (staggered delay 40ms per card).
  3. Metric cards count-up animation on dashboard mount.
  4. Active backup stream progress indicator pulse & shimmer.
  5. Modal dialog enter/exit with scale & backdrop fade (`AnimatePresence`).
* **Accessibility**: Enforce `prefers-reduced-motion: reduce` fallback.
