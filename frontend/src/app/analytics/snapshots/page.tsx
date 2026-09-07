import { AnalyticsSubNav } from "@/components/analytics/analytics-sub-nav";
import { PaginationBar } from "@/components/analytics/pagination-bar";
import { serverFetch } from "@/lib/server-api";
import { formatBytes, formatDate } from "@/lib/utils";
import type { RepoAnalyticsSnapshot } from "@/types";

interface SnapshotsResponse {
  data: RepoAnalyticsSnapshot[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

async function fetchSnapshots(
  page: number,
  pageSize: number,
): Promise<SnapshotsResponse | null> {
  return serverFetch<SnapshotsResponse>(
    `/api/analytics/history?page=${page}&page_size=${pageSize}`,
  );
}

export default async function SnapshotsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;

  const result = await fetchSnapshots(page, pageSize);
  const snapshots = result?.data || [];
  const pagination = result?.pagination;
  const latest = page === 1 && snapshots.length > 0 ? snapshots[0] : null;

  return (
    <div className="page">
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-kicker">Analytics / Git Snapshots</div>
          <h1 className="page-title">Repository Snapshots</h1>
          <p className="page-subtitle">
            Git metadata captured by the backend collector at each backup point
            — commits, branches, tags, blob sizes, and archive sizes.
          </p>
        </div>
        {snapshots.length > 0 && (
          <div className="pill" style={{ alignSelf: "flex-start" }}>
            {pagination?.total_items || snapshots.length} snapshot
            {(pagination?.total_items || snapshots.length) !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      <AnalyticsSubNav />

      {/* -- Latest snapshot summary ----------------------------------- */}
      {latest && (
        <section className="card section-card">
          <div className="section-title">Latest snapshot</div>
          <div className="section-desc">
            Captured {formatDate(latest.captured_at)}
            {latest.head_commit && (
              <>
                {" "}
                · commit{" "}
                <code
                  style={{
                    fontSize: 14,
                    fontFamily: "monospace",
                    color: "var(--accent)",
                  }}
                >
                  {latest.head_commit.slice(0, 10)}
                </code>
              </>
            )}
            {latest.head_commit_message && ` — ${latest.head_commit_message}`}
          </div>
          <div
            className="metric-grid metric-grid--four"
            style={{ marginTop: 14 }}
          >
            <div className="card-flat">
              <div className="stat-label">Total commits</div>
              <div className="stat-value stat-value--md">
                {latest.total_commits}
              </div>
            </div>
            <div className="card-flat">
              <div className="stat-label">Branches</div>
              <div className="stat-value stat-value--md">
                {latest.branch_count}
              </div>
            </div>
            <div className="card-flat">
              <div className="stat-label">Tracked files</div>
              <div className="stat-value stat-value--md">
                {latest.tracked_files}
              </div>
            </div>
            <div className="card-flat">
              <div className="stat-label">Total archive size</div>
              <div className="stat-value stat-value--md">
                {formatBytes(latest.total_archive_size_bytes)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* -- History table --------------------------------------------- */}
      <section className="card section-card">
        <div className="section-title">Full history</div>

        {!result ? (
          <p style={{ color: "var(--danger)", fontSize: 15, paddingTop: 12 }}>
            Failed to load snapshots. Check the backend is running.
          </p>
        ) : snapshots.length === 0 ? (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <p
              style={{
                fontWeight: 600,
                fontSize: 16,
                color: "var(--text-secondary)",
              }}
            >
              No snapshots yet
            </p>
            <p style={{ fontSize: 15, marginTop: 8 }}>
              Run the backup worker to start collecting repository analytics.
            </p>
          </div>
        ) : (
          <>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="table table-wide">
                <thead>
                  <tr>
                    <th style={{ whiteSpace: "nowrap" }}>Captured at</th>
                    <th style={{ whiteSpace: "nowrap" }}>Commit</th>
                    <th>Message</th>
                    <th style={{ whiteSpace: "nowrap" }}>Commits</th>
                    <th style={{ whiteSpace: "nowrap" }}>Branches</th>
                    <th style={{ whiteSpace: "nowrap" }}>Tags</th>
                    <th style={{ whiteSpace: "nowrap" }}>Files</th>
                    <th style={{ whiteSpace: "nowrap" }}>Blob size</th>
                    <th style={{ whiteSpace: "nowrap" }}>Archive size</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snap) => (
                    <tr key={snap.id}>
                      <td
                        data-label="Captured at"
                        style={{
                          fontSize: 13.5,
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(snap.captured_at)}
                      </td>
                      <td
                        data-label="Commit"
                        style={{
                          fontSize: 14,
                          fontFamily: "monospace",
                          color: "var(--text-muted)",
                        }}
                      >
                        {snap.head_commit ? snap.head_commit.slice(0, 10) : "—"}
                      </td>
                      <td
                        data-label="Message"
                        className="truncate"
                        style={{ maxWidth: 180, fontSize: 14 }}
                        title={snap.head_commit_message}
                      >
                        {snap.head_commit_message || "—"}
                      </td>
                      <td data-label="Commits">{snap.total_commits}</td>
                      <td data-label="Branches">{snap.branch_count}</td>
                      <td data-label="Tags">{snap.tag_count}</td>
                      <td data-label="Files">{snap.tracked_files}</td>
                      <td data-label="Blob size">
                        {formatBytes(snap.total_blob_size_bytes)}
                      </td>
                      <td data-label="Archive size">
                        {formatBytes(snap.total_archive_size_bytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && (
              <PaginationBar
                page={pagination.page}
                totalPages={pagination.total_pages}
                pageSize={pagination.page_size}
                totalItems={pagination.total_items}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
