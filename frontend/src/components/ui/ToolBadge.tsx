import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ToolBadgeProps {
  name: string;
  active?: boolean;
  className?: string;
}

export function ToolBadge({ name, active = true, className }: ToolBadgeProps) {
  return (
    <Badge
      variant={active ? "secondary" : "outline"}
      className={cn(
        "font-mono text-[10px] px-2 py-0",
        active && "bg-primary/10 text-primary border-primary/20",
        className,
      )}
    >
      {name}
    </Badge>
  );
}
