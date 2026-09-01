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
    <div className="m-page">
      <div
        className="m-card"
        style={{
          background: "rgba(24, 24, 27, 0.4)",
          borderLeft: "4px solid var(--iris-500)",
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
            <div className="m-kicker">
              <Link
                href="/backups"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                Backup History
              </Link>{" "}
              / Investigation
            </div>
            <h1 className="m-title" style={{ marginTop: 8 }}>
              Run #{run.id}
            </h1>
            <p
              className="m-subtitle"
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
              style={{
                color: "var(--critical-500)",
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--critical-500)",
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
        <div className="m-grid m-grid--metrics" style={{ marginTop: 24 }}>
          <div
            className="m-card m-card--quiet"
            style={{ background: "transparent" }}
          >
            <div className="m-metric__label">Total Repos</div>
            <div className="m-metric__value">{run.total_repos}</div>
          </div>
          <div
            className="m-card m-card--quiet"
            style={{ background: "transparent" }}
          >
            <div className="m-metric__label">Successful</div>
            <div className="m-metric__value m-metric__value--positive">
              {run.successful}
            </div>
          </div>
          <div
            className="m-card m-card--quiet"
            style={{ background: "transparent" }}
          >
            <div className="m-metric__label">Failed</div>
            <div className="m-metric__value m-metric__value--critical">
              {run.failed}
            </div>
          </div>
          <div
            className="m-card m-card--quiet"
            style={{ background: "transparent" }}
          >
            <div className="m-metric__label">Skipped</div>
            <div className="m-metric__value m-text-muted">{run.skipped}</div>
          </div>
        </div>
      </div>

      {/* Repository results */}
      <section className="m-card m-card--roomy">
        <div className="m-section__title" style={{ marginBottom: 16 }}>
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
          <div className="m-table-wrap" style={{ marginTop: 14 }}>
            <table className="m-table m-table--wide">
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
                            color: "var(--critical-500)",
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
