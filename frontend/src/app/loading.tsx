import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="m-viewport-state">
      <section className="m-card m-state" aria-busy="true" aria-live="polite">
        <div className="m-state__icon">
          <Loader2
            size={24}
            className="m-spinner"
            style={{ color: "var(--iris-500)" }}
            aria-hidden="true"
          />
        </div>
        <h1 className="m-state__title">Loading workspace</h1>
        <p className="m-state__description">
          Retrieving the latest backup telemetry and repository health data.
        </p>
      </section>
    </div>
  );
}
