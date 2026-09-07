import Link from "next/link";
import { AnalyticsSubNav } from "@/components/analytics/analytics-sub-nav";
import { PaginationBar } from "@/components/analytics/pagination-bar";
import { serverFetch } from "@/lib/server-api";
import { formatDate, formatDuration } from "@/lib/utils";
import type { BackupRun } from "@/types";

interface RunsResponse {
  data: BackupRun[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

async function fetchRuns(
  page: number,
  pageSize: number,
): Promise<RunsResponse | null> {
  return serverFetch<RunsResponse>(
    `/api/backups?page=${page}&page_size=${pageSize}`,
  );
}

export default async function RunHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;

  const result = await fetchRuns(page, pageSize);
  const runs = result?.data || [];
  const pagination = result?.pagination;

  return (
    <div className="page">
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-kicker">Analytics / Run History</div>
          <h1 className="page-title">Backup Runs</h1>
          <p className="page-subtitle">
            Full paginated history of all backup runs. Click a run to see
            per-repository results.
          </p>
        </div>
      </div>

      <AnalyticsSubNav />

      <section className="card section-card">
        {!result ? (
          <p style={{ color: "var(--danger)", fontSize: 15 }}>
            Failed to load run history. Check the backend is running.
          </p>
        ) : runs.length === 0 ? (
          <EmptyRuns />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table table-wide">
                <thead>
                  <tr>
                    <th style={{ whiteSpace: "nowrap" }}>Run #</th>
                    <th style={{ whiteSpace: "nowrap" }}>Status</th>
                    <th style={{ whiteSpace: "nowrap" }}>Started</th>
                    <th style={{ whiteSpace: "nowrap" }}>Duration</th>
                    <th style={{ whiteSpace: "nowrap" }}>Repos</th>
                    <th style={{ whiteSpace: "nowrap" }}>Success</th>
                    <th style={{ whiteSpace: "nowrap" }}>Failed</th>
                    <th style={{ whiteSpace: "nowrap" }}>Skipped</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td
                        data-label="Run #"
                        style={{ fontWeight: 600, whiteSpace: "nowrap" }}
                      >
                        #{run.id}
                      </td>
                      <td data-label="Status" style={{ whiteSpace: "nowrap" }}>
                        <span
                          className={`badge ${
                            run.status === "completed"
                              ? "badge-success"
                              : run.status === "running"
                                ? "badge-running"
                                : "badge-error"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td
                        data-label="Started"
                        style={{
                          fontSize: 13.5,
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(run.started_at)}
                      </td>
                      <td data-label="Duration">
                        {formatDuration(run.duration_ms)}
                      </td>
                      <td data-label="Repos">{run.total_repos}</td>
                      <td
                        data-label="Success"
                        style={{ color: "var(--success)" }}
                      >
                        {run.successful}
                      </td>
                      <td
                        data-label="Failed"
                        style={{
                          color: run.failed > 0 ? "var(--danger)" : "inherit",
                        }}
                      >
                        {run.failed}
                      </td>
                      <td data-label="Skipped" className="text-muted">
                        {run.skipped}
                      </td>
                      <td data-label="Details">
                        <Link
                          href={`/backups/${run.id}`}
                          className="btn btn-ghost"
                          style={{ fontSize: 14 }}
                        >
                          Details →
                        </Link>
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

function EmptyRuns() {
  return (
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
        No runs found
      </p>
      <p style={{ fontSize: 15, marginTop: 8 }}>
        Start the backup worker to create a backup run.
      </p>
    </div>
  );
}
