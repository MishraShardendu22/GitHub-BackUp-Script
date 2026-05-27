import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  TrendingUp,
} from "lucide-react";
import { formatDuration, formatDate, timeAgo } from "@/lib/utils";
import type { DashboardStats, BackupRun, ExecutionLog } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function fetchStats(): Promise<DashboardStats | null> {
  try {
    const res = await fetch(`${API}/api/dashboard/stats`, { cache: "no-store" });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

async function fetchRecentRuns(): Promise<BackupRun[]> {
  try {
    const res = await fetch(`${API}/api/backups?limit=5`, { cache: "no-store" });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

async function fetchRecentLogs(): Promise<ExecutionLog[]> {
  try {
    const res = await fetch(`${API}/api/logs?limit=8`, { cache: "no-store" });
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

export default async function DashboardPage() {
  const [stats, runs, logs] = await Promise.all([
    fetchStats(),
    fetchRecentRuns(),
    fetchRecentLogs(),
  ]);

  const statCards = [
    {
      label: "Total Runs",
      value: stats?.total_runs ?? 0,
      icon: Activity,
      color: "#6366f1",
    },
    {
      label: "Success Rate",
      value: stats?.success_rate ? `${stats.success_rate.toFixed(1)}%` : "N/A",
      icon: TrendingUp,
      color: "#10b981",
    },
    {
      label: "Total Repos",
      value: stats?.total_repos ?? 0,
      icon: Database,
      color: "#8b5cf6",
    },
    {
      label: "Avg Duration",
      value: stats?.avg_duration_ms ? formatDuration(stats.avg_duration_ms) : "N/A",
      icon: Clock,
      color: "#f59e0b",
    },
    {
      label: "Successful",
      value: (stats?.total_repos ?? 0) - (stats?.total_failed ?? 0),
      icon: CheckCircle2,
      color: "#10b981",
    },
    {
      label: "Failed",
      value: stats?.total_failed ?? 0,
      icon: XCircle,
      color: "#ef4444",
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Overview of your GitHub backup system
        </p>
      </div>

      {/* Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {card.label}
                </span>
                <Icon size={18} style={{ color: card.color }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{card.value}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Recent Runs */}
        <div className="card">
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Activity size={18} /> Recent Backup Runs
          </h2>
          {runs.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              No backup runs yet
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Repos</th>
                  <th>Duration</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <span className={`badge ${statusBadge(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#10b981" }}>{run.successful}</span>
                      {" / "}
                      <span style={{ color: "#ef4444" }}>{run.failed}</span>
                      {" / "}
                      {run.total_repos}
                    </td>
                    <td>{formatDuration(run.duration_ms)}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      {timeAgo(run.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Logs */}
        <div className="card">
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Clock size={18} /> Recent Logs
          </h2>
          {logs.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              No logs yet
            </p>
          ) : (
            <div style={{ fontSize: 13, fontFamily: "var(--font-geist-mono)" }}>
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: "6px 0",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <span
                    className={`log-${log.level}`}
                    style={{ fontWeight: 600, minWidth: 40 }}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span style={{ color: "var(--text-secondary)", flex: 1 }}>
                    {log.message}
                  </span>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                    {timeAgo(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
