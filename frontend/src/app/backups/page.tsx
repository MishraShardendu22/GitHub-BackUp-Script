import { History } from "lucide-react";
import { formatDuration, formatDate } from "@/lib/utils";
import type { BackupRun } from "@/lib/types";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function fetchRuns(): Promise<BackupRun[]> {
  try {
    const res = await fetch(`${API}/api/backups?limit=50`, { cache: "no-store" });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "badge-success",
    running: "badge-running",
    failed: "badge-error",
  };
  return map[status] || "badge-neutral";
}

export default async function BackupsPage() {
  const runs = await fetchRuns();

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <History size={28} /> Backup History
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          View all backup runs and their results
        </p>
      </div>

      <div className="card">
        {runs.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", padding: 40, textAlign: "center" }}>
            No backup runs found. Run the worker to create backups.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Total</th>
                <th>Success</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td style={{ fontFamily: "var(--font-geist-mono)", fontSize: 13 }}>
                    #{run.id}
                  </td>
                  <td>
                    <span className={`badge ${statusBadge(run.status)}`}>
                      {run.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{formatDate(run.started_at)}</td>
                  <td>{formatDuration(run.duration_ms)}</td>
                  <td>{run.total_repos}</td>
                  <td style={{ color: "#10b981" }}>{run.successful}</td>
                  <td style={{ color: run.failed > 0 ? "#ef4444" : "inherit" }}>
                    {run.failed}
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{run.skipped}</td>
                  <td>
                    <Link
                      href={`/backups/${run.id}`}
                      className="btn btn-outline"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                    >
                      View
                    </Link>
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
