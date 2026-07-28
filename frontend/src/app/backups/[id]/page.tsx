import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { serverFetch } from "@/lib/server-api";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils";
import type { BackupResult, BackupRun } from "@/types";

interface BackupDetail {
  run: BackupRun;
  results: BackupResult[];
}

async function fetchBackupDetail(id: string): Promise<BackupDetail | null> {
  return serverFetch<BackupDetail>(`/api/backups/${id}`);
}

export default async function BackupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchBackupDetail(id);

  if (!data?.run) {
    notFound();
  }

  const { run, results = [] } = data;

  return (
    <div className="page">
      <div
        className="card"
        style={{
          background: "rgba(24, 24, 27, 0.4)",
          borderLeft: "4px solid var(--accent)",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div className="page-kicker">
              <Link
                href="/backups"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                Backup History
              </Link>{" "}
              / Investigation
            </div>
            <h1 className="page-title" style={{ marginTop: 8 }}>
              Run #{run.id}
            </h1>
            <p className="page-subtitle" style={{ marginTop: 8 }}>
              Started {formatDate(run.started_at)} ·{" "}
              {formatDuration(run.duration_ms)}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Run Status
            </div>
            <StatusBadge status={run.status} />
          </div>
        </div>

        {/* Summary metrics */}
        <div
          className="metric-grid metric-grid--four stats-grid"
          style={{ marginTop: 24 }}
        >
          <div className="card-flat" style={{ background: "transparent" }}>
            <div className="stat-label">Total Repos</div>
            <div className="stat-value">{run.total_repos}</div>
          </div>
          <div className="card-flat" style={{ background: "transparent" }}>
            <div className="stat-label">Successful</div>
            <div className="stat-value stat-value--success">
              {run.successful}
            </div>
          </div>
          <div className="card-flat" style={{ background: "transparent" }}>
            <div className="stat-label">Failed</div>
            <div className="stat-value stat-value--danger">{run.failed}</div>
          </div>
          <div className="card-flat" style={{ background: "transparent" }}>
            <div className="stat-label">Skipped</div>
            <div className="stat-value text-muted">{run.skipped}</div>
          </div>
        </div>
      </div>

      {/* Repository results */}
      <section className="card section-card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          Repository Investigation Logs
        </div>
        {results.length === 0 ? (
          <p
            style={{
              fontSize: 15,
              color: "var(--text-muted)",
              padding: "20px 0",
            }}
          >
            No repository logs for this run.
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table table-wide">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Status</th>
                  <th>Archive size</th>
                  <th>Commit</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id}>
                    <td data-label="Repository" style={{ fontWeight: 500 }}>
                      {result.repo_full_name}
                    </td>
                    <td data-label="Status">
                      <StatusBadge status={result.status} />
                    </td>
                    <td data-label="Archive size">
                      {result.archive_size_bytes > 0
                        ? formatBytes(result.archive_size_bytes)
                        : "—"}
                    </td>
                    <td
                      data-label="Commit"
                      style={{
                        fontSize: 14,
                        fontFamily: "monospace",
                        color: "var(--text-muted)",
                      }}
                    >
                      {result.commit_hash
                        ? result.commit_hash.slice(0, 10)
                        : "—"}
                    </td>
                    <td
                      data-label="Error"
                      style={{
                        fontSize: 14,
                        color: result.error_message
                          ? "var(--danger)"
                          : "var(--text-muted)",
                        maxWidth: 280,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={result.error_message || ""}
                    >
                      {result.error_message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
