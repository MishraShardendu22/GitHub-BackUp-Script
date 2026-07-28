import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-error">
      <section className="card state-card">
        <div className="state-card__icon">
          <SearchX size={21} aria-hidden="true" />
        </div>
        <h1 className="state-card__title">Run not found</h1>
        <p className="state-card__description">
          This backup run may have been removed, or the link is incomplete.
        </p>
        <Link
          href="/backups"
          className="btn btn-outline"
          style={{ marginTop: 24 }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to history
        </Link>
      </section>
    </div>
  );
}
