export const STATUS_COLORS = {
  completed: "text-emerald-400",
  running: "text-blue-400",
  failed: "text-red-400",
  skipped: "text-zinc-400",
  default: "text-zinc-300",
} as const;

export const STATUS_BACKGROUNDS = {
  completed: "bg-emerald-500/10 border-emerald-500/20",
  running: "bg-blue-500/10 border-blue-500/20",
  failed: "bg-red-500/10 border-red-500/20",
  skipped: "bg-zinc-500/10 border-zinc-500/20",
  default: "bg-zinc-500/10 border-zinc-500/20",
} as const;

export const BADGE_CLASSES = {
  success: "m-badge--positive",
  running: "m-badge--accent",
  error: "m-badge--critical",
  warning: "badge-warning",
} as const;
