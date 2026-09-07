"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="m-viewport-state">
      <section className="m-card m-state" role="alert">
        <div className="m-state__icon" style={{ color: "var(--critical-500)" }}>
          <AlertTriangle size={21} aria-hidden="true" />
        </div>
        <h1 className="m-state__title">The workspace could not load</h1>
        <p className="m-state__description">
          The connection was interrupted or the backup service is unavailable.
          Please try again.
        </p>
        <button
          type="button"
          className="m-btn m-btn--primary"
          onClick={reset}
          style={{ marginTop: 24 }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Try again
        </button>
      </section>
    </div>
  );
}
