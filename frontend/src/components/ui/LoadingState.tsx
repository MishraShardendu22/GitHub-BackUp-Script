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
  const spinnerSize = size === "sm" ? 12 : size === "lg" ? 24 : 16;

  return (
    <div
      className={cn("loading-state", className)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "var(--text-secondary)",
        fontSize: size === "sm" ? "12px" : "13px",
      }}
    >
      <div
        className="ai-loader-spinner"
        style={{
          width: spinnerSize,
          height: spinnerSize,
          borderWidth: size === "sm" ? 1.5 : 2,
          margin: 0,
        }}
      />
      <span>{message}</span>
    </div>
  );
}
