"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-error">
      <section className="card state-card" role="alert">
        <div className="state-card__icon" style={{ color: "var(--danger)" }}>
          <AlertTriangle size={21} aria-hidden="true" />
        </div>
        <h1 className="state-card__title">The workspace could not load</h1>
        <p className="state-card__description">
          The connection was interrupted or the backup service is unavailable.
          Please try again.
        </p>
        <button
          type="button"
          className="btn btn-primary"
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
