import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  message,
  retry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[200px] p-8 text-center",
        className,
      )}
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-destructive">
        {title || "An error occurred"}
      </h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">{message}</p>
      {retry && (
        <Button onClick={retry} variant="outline" className="mt-6 gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
