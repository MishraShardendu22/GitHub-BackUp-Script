import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const badgeClass =
    status === "completed"
      ? "badge-success"
      : status === "running"
        ? "badge-running"
        : status === "failed"
          ? "badge-error"
          : "badge";

  return <span className={cn("badge", badgeClass, className)}>{status}</span>;
}
