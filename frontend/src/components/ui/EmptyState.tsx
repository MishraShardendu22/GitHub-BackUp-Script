import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  message,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("m-state m-state--inline", className)}>
      <div className="m-state__icon">
        {icon ?? <Inbox size={21} aria-hidden="true" />}
      </div>
      <p className="m-state__title">{message}</p>
      {description && <p className="m-state__description">{description}</p>}
      {action && <div className="m-state__actions">{action}</div>}
    </div>
  );
}
