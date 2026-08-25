import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="page-loading">
      <section className="card state-card" aria-busy="true" aria-live="polite">
        <div className="state-card__icon">
          <Loader2
            size={24}
            className="spin"
            style={{ color: "var(--accent)" }}
            aria-hidden="true"
          />
        </div>
        <h1 className="state-card__title">Loading workspace</h1>
        <p className="state-card__description">
          Retrieving the latest backup telemetry and repository health data.
        </p>
      </section>
    </div>
  );
}
