import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  completed: "m-badge--positive",
  success: "m-badge--positive",
  running: "m-badge--accent",
  pending: "m-badge--caution",
  failed: "m-badge--critical",
  error: "m-badge--critical",
};

const DOT: Record<string, string> = {
  completed: "m-dot--positive",
  success: "m-dot--positive",
  running: "m-dot--accent",
  pending: "m-dot--caution",
  failed: "m-dot--critical",
  error: "m-dot--critical",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status?.toLowerCase() ?? "";
  return (
    <span className={cn("m-badge", TONE[key] ?? "m-badge--quiet", className)}>
      <span className={cn("m-dot", DOT[key])} aria-hidden="true" />
      {status}
    </span>
  );
}
