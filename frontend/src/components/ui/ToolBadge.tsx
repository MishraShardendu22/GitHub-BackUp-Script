import { cn } from "@/lib/utils";

interface ToolBadgeProps {
  name: string;
  active?: boolean;
  className?: string;
}

export function ToolBadge({ name, active = true, className }: ToolBadgeProps) {
  return (
    <span
      className={cn(
        "m-badge",
        active ? "m-badge--accent" : "m-badge--quiet",
        className,
      )}
    >
      {name}
    </span>
  );
}
