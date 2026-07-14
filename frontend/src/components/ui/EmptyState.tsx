import { FolderSearch } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  message?: string; // For backwards compatibility
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  message,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[200px] p-8 text-center",
        className,
      )}
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted text-muted-foreground mb-4 opacity-50">
        {icon || <FolderSearch className="h-8 w-8" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        {title || "No data available"}
      </h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        {description ||
          message ||
          "There are no records to display at this time."}
      </p>
    </div>
  );
}
