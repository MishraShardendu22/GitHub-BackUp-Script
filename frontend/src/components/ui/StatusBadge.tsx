import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusVariant = () => {
    switch (status) {
      case "completed":
      case "success":
        return "default";
      case "running":
        return "secondary";
      case "failed":
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  const variant = getStatusVariant();

  return (
    <Badge
      variant={variant}
      className={cn(
        "px-2.5 py-0.5 text-xs font-semibold capitalize",
        variant === "default" &&
          "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20",
        className,
      )}
    >
      {status}
    </Badge>
  );
}
