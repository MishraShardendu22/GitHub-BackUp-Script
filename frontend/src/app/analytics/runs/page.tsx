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
    <div className="m-page">
      <div className="m-masthead" style={{ marginBottom: 24 }}>
        <div>
          <div className="m-kicker">Analytics / Run History</div>
          <h1 className="m-title">Backup Runs</h1>
          <p className="m-subtitle">
            Full paginated history of all backup runs. Click a run to see
            per-repository results.
          </p>
        </div>
      </div>

      <AnalyticsSubNav />

      <section className="m-card m-card--roomy">
        {!result ? (
          <p style={{ color: "var(--critical-500)", fontSize: 15 }}>
            Failed to load run history. Check the backend is running.
          </p>
        ) : runs.length === 0 ? (
          <EmptyRuns />
        ) : (
          <>
            <div className="m-table-wrap">
              <table className="m-table m-table--wide">
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
                          className={`m-badge ${
                            run.status === "completed"
                              ? "m-badge--positive"
                              : run.status === "running"
                                ? "m-badge--accent"
                                : "m-badge--critical"
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
                        style={{ color: "var(--positive-500)" }}
                      >
                        {run.successful}
                      </td>
                      <td
                        data-label="Failed"
                        style={{
                          color:
                            run.failed > 0 ? "var(--critical-500)" : "inherit",
                        }}
                      >
                        {run.failed}
                      </td>
                      <td data-label="Skipped" className="m-text-muted">
                        {run.skipped}
                      </td>
                      <td data-label="Details">
                        <Link
                          href={`/backups/${run.id}`}
                          className="m-btn m-btn--ghost"
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
