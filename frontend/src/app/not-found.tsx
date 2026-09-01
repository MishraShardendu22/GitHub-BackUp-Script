import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="m-viewport-state">
      <section className="m-card m-state">
        <div className="m-state__icon">
          <SearchX size={21} aria-hidden="true" />
        </div>
        <h1 className="m-state__title">Run not found</h1>
        <p className="m-state__description">
          This backup run may have been removed, or the link is incomplete.
        </p>
        <Link
          href="/backups"
          className="m-btn m-btn--secondary"
          style={{ marginTop: 24 }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to history
        </Link>
      </section>
    </div>
  );
}
