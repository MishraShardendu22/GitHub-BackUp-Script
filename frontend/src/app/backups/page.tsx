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

export default async function BackupsPage() {
  const runs = await fetchRuns();

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>
          HISTORY
        </div>
        <h1 style={{ fontSize: 36, fontFamily: "var(--font-serif)", marginBottom: 8 }}>
          Backup runs
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Complete history of all backup executions and their results.
        </p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {runs.length === 0 ? (
          <p style={{ color: "var(--text-muted)", padding: 48, textAlign: "center", fontSize: 14 }}>
            No backup runs found. Run the worker to create backups.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Total</th>
                <th>Success</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td style={{ fontWeight: 500 }}>#{run.id}</td>
                  <td>
                    <span className={`badge ${run.status === "completed" ? "badge-success" : run.status === "running" ? "badge-running" : "badge-error"}`}>
                      {run.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(run.started_at)}</td>
                  <td>{formatDuration(run.duration_ms)}</td>
                  <td>{run.total_repos}</td>
                  <td style={{ color: "var(--success)" }}>{run.successful}</td>
                  <td style={{ color: run.failed > 0 ? "var(--danger)" : "inherit" }}>{run.failed}</td>
                  <td style={{ color: "var(--text-muted)" }}>{run.skipped}</td>
                  <td>
                    <Link href={`/backups/${run.id}`} className="btn btn-ghost" style={{ fontSize: 12 }}>
                      View →
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
