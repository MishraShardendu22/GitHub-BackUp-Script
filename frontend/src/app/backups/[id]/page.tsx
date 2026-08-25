import { AlertCircle } from "lucide-react";
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
            <p
              className="page-subtitle"
              style={{ marginTop: 8, whiteSpace: "nowrap" }}
            >
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

        {/* Run-level error banner */}
        {run.error_message && (
          <div
            style={{
              marginTop: 20,
              padding: "14px 18px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <AlertCircle
              size={18}
              style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--danger)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Run Execution Error
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  color: "var(--text)",
                  marginTop: 4,
                  wordBreak: "break-word",
                  fontFamily: "var(--font-mono, monospace)",
                  lineHeight: 1.5,
                }}
              >
                {run.error_message}
              </div>
            </div>
          </div>
        )}

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
                  <th style={{ minWidth: "260px" }}>Repository</th>
                  <th style={{ whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ whiteSpace: "nowrap" }}>Archive size</th>
                  <th style={{ whiteSpace: "nowrap" }}>Commit</th>
                  <th style={{ minWidth: "240px" }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id}>
                    <td
                      data-label="Repository"
                      style={{ fontWeight: 500, wordBreak: "break-all" }}
                    >
                      {result.repo_full_name}
                    </td>
                    <td data-label="Status" style={{ whiteSpace: "nowrap" }}>
                      <StatusBadge status={result.status} />
                    </td>
                    <td
                      data-label="Archive size"
                      style={{ whiteSpace: "nowrap" }}
                    >
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
                        whiteSpace: "nowrap",
                      }}
                    >
                      {result.commit_hash
                        ? result.commit_hash.slice(0, 10)
                        : "—"}
                    </td>
                    <td
                      data-label="Error"
                      style={{
                        fontSize: 13,
                        minWidth: 200,
                        maxWidth: 460,
                      }}
                    >
                      {result.error_message ? (
                        <div
                          style={{
                            color: "var(--danger)",
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: 12,
                            background: "rgba(239, 68, 68, 0.08)",
                            padding: "6px 10px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            wordBreak: "break-word",
                            lineHeight: 1.45,
                            whiteSpace: "pre-wrap",
                          }}
                          title={result.error_message}
                        >
                          {result.error_message}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
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
