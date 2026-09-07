import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "Loading",
  className,
}: LoadingStateProps) {
  return (
    <p
      className={cn("m-cluster m-cluster--tight m-caption", className)}
      role="status"
      aria-live="polite"
    >
      <span className="m-spinner" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
