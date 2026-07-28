import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  message: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({ message, retry, className }: ErrorStateProps) {
  return (
    <div
      className={cn("error-state", className)}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "200px",
        gap: "16px",
      }}
    >
      <div
        role="alert"
        style={{
          color: "var(--danger)",
          fontSize: "14px",
          textAlign: "center",
        }}
      >
        <AlertTriangle
          size={18}
          aria-hidden="true"
          style={{ verticalAlign: "-3px", marginRight: 6 }}
        />
        {message}
      </div>
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="btn btn-outline"
          style={{ fontSize: "12px" }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}
