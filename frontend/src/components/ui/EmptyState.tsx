import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  message,
  description,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn("empty-state", className)}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "200px",
        color: "var(--text-secondary)",
        fontSize: "14px",
        gap: "12px",
      }}
    >
      {icon && <div style={{ opacity: 0.5 }}>{icon}</div>}
      <p className="empty-state__title">{message}</p>
      {description && <p className="empty-state__description">{description}</p>}
    </div>
  );
}
