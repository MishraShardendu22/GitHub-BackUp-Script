export default function Loading() {
  return (
    <div className="page-loading">
      <section className="card state-card" aria-busy="true" aria-live="polite">
        <div className="state-card__icon">
          <span className="spinner" aria-hidden="true">
            ◌
          </span>
        </div>
        <h1 className="state-card__title">Loading workspace</h1>
        <p className="state-card__description">
          Retrieving the latest backup telemetry and repository health data.
        </p>
      </section>
    </div>
  );
}
