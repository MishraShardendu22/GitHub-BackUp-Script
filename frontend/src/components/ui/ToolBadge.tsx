import { cn } from "@/lib/utils";

interface ToolBadgeProps {
  name: string;
  active?: boolean;
  className?: string;
}

export function ToolBadge({ name, active = true, className }: ToolBadgeProps) {
  return (
    <span className={cn("ai-tool-badge", active && "active", className)}>
      {name}
    </span>
  );
}
