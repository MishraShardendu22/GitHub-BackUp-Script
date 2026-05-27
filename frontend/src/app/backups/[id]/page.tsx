import { formatDuration, formatDate, formatBytes } from "@/lib/utils";
import type { BackupRun, BackupResult } from "@/lib/types";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function fetchRunDetail(id: string): Promise<{ run: BackupRun; results: BackupResult[] } | null> {
  try {
    const res = await fetch(`${API}/api/backups/${id}`, { cache: "no-store" });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export default async function BackupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchRunDetail(id);

  if (!data) {
    return (
      <div style={{ textAlign: "center", paddingTop: 100 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28 }}>Run not found</h2>
        <Link href="/backups" className="btn btn-outline" style={{ marginTop: 16, display: "inline-flex" }}>← Back</Link>
      </div>
    );
  }

  const { run, results } = data;

  return (
    <div>
      <Link href="/backups" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>
        ← Back to runs
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 36, fontFamily: "var(--font-serif)", marginBottom: 8 }}>
            Run #{run.id}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {formatDate(run.started_at)} · {formatDuration(run.duration_ms)}
          </p>
        </div>
        <span className={`badge ${run.status === "completed" ? "badge-success" : "badge-error"}`} style={{ fontSize: 13, padding: "6px 14px" }}>
          {run.status}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{run.total_repos}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>{run.successful}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed</div>
          <div className="stat-value" style={{ color: run.failed > 0 ? "var(--danger)" : "inherit" }}>{run.failed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Skipped</div>
          <div className="stat-value">{run.skipped}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-light)" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Repository results</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>({results.length})</span>
        </div>
        {results.length === 0 ? (
          <p style={{ color: "var(--text-muted)", padding: 32, textAlign: "center" }}>No results</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Status</th>
                <th>Hash</th>
                <th>Size</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{r.repo_full_name}</td>
                  <td>
                    <span className={`badge ${r.status === "completed" ? "badge-success" : r.status === "failed" ? "badge-error" : "badge-neutral"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {r.commit_hash ? r.commit_hash.slice(0, 8) : "—"}
                  </td>
                  <td style={{ fontSize: 13 }}>{r.archive_size_bytes > 0 ? formatBytes(r.archive_size_bytes) : "—"}</td>
                  <td style={{ color: "var(--danger)", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.error_message || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
