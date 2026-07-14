import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingState({
  message = "Loading...",
  className,
  size = "md",
}: LoadingStateProps) {
  const iconSizeClass = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-6 w-6",
  }[size];

  const textSizeClass = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 text-muted-foreground animate-in fade-in duration-300",
        className,
      )}
    >
      <Loader2 className={cn("animate-spin text-primary", iconSizeClass)} />
      {message && (
        <span className={cn("font-medium", textSizeClass)}>{message}</span>
      )}
    </div>
  );
}
