import { ArrowLeft, CheckCircle2, XCircle, SkipForward } from "lucide-react";
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

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "badge-success",
    running: "badge-running",
    failed: "badge-error",
    skipped: "badge-neutral",
  };
  return map[status] || "badge-neutral";
}

export default async function BackupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchRunDetail(id);

  if (!data) {
    return (
      <div style={{ textAlign: "center", paddingTop: 100 }}>
        <h2 style={{ fontSize: 20 }}>Backup run not found</h2>
        <Link href="/backups" className="btn btn-outline" style={{ marginTop: 16, display: "inline-flex" }}>
          <ArrowLeft size={16} /> Back to History
        </Link>
      </div>
    );
  }

  const { run, results } = data;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/backups"
          style={{
            color: "var(--text-secondary)",
            fontSize: 13,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={14} /> Back to History
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          Backup Run #{run.id}
          <span className={`badge ${statusBadge(run.status)}`} style={{ fontSize: 14 }}>
            {run.status}
          </span>
        </h1>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 32 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{run.total_repos}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Total</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>{run.successful}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Success</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>{run.failed}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Failed</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-secondary)" }}>{run.skipped}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Skipped</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatDuration(run.duration_ms)}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Duration</div>
        </div>
      </div>

      <div style={{ marginBottom: 16, fontSize: 13, color: "var(--text-secondary)" }}>
        Started: {formatDate(run.started_at)}
        {run.completed_at && ` • Completed: ${formatDate(run.completed_at)}`}
      </div>

      {/* Per-repo Results Table */}
      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Repository Results ({results.length})
        </h2>
        {results.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No results recorded</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Status</th>
                <th>Hash</th>
                <th>Size</th>
                <th>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: "var(--font-geist-mono)", fontSize: 13 }}>
                    {r.repo_full_name}
                  </td>
                  <td>
                    <span className={`badge ${statusBadge(r.status)}`}>
                      {r.status === "completed" && <CheckCircle2 size={12} />}
                      {r.status === "failed" && <XCircle size={12} />}
                      {r.status === "skipped" && <SkipForward size={12} />}
                      {" "}{r.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
                    {r.commit_hash ? r.commit_hash.slice(0, 8) : "—"}
                  </td>
                  <td>{r.archive_size_bytes > 0 ? formatBytes(r.archive_size_bytes) : "—"}</td>
                  <td>{r.duration_ms > 0 ? formatDuration(r.duration_ms) : "—"}</td>
                  <td style={{ color: "#ef4444", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
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
