"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  message: string;
  description?: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({
  message,
  description,
  retry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn("m-state m-state--inline", className)}
      role="alert"
      aria-live="assertive"
    >
      <div className="m-state__icon m-state__icon--critical">
        <AlertTriangle size={21} aria-hidden="true" />
      </div>
      <p className="m-state__title">{message}</p>
      {description && <p className="m-state__description">{description}</p>}
      {retry && (
        <div className="m-state__actions">
          <button
            type="button"
            onClick={retry}
            className="m-btn m-btn--secondary m-btn--sm"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
