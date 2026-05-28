import { formatDuration, formatDate, formatBytes } from "@/lib/utils";
import type { DashboardStats, BackupRun, BackupResult } from "@/lib/types";

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

async function fetchRepos(): Promise<Array<{ full_name: string; last_status: string; archive_size_bytes: number }>> {
  try {
    const res = await fetch(`${API}/api/repos`, { cache: "no-store" });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const [stats, runs, repos] = await Promise.all([
    fetchStats(),
    fetchRecentRuns(),
    fetchRepos(),
  ]);

  const latestRun = runs.length > 0 ? runs[0] : null;
  const totalSize = stats?.total_size_bytes ?? repos.reduce((a, r) => a + (r.archive_size_bytes || 0), 0);
  const failureCount = stats?.total_failed ?? 0;
  const totalSkipped = stats?.total_skipped ?? 0;
  const totalLogs = stats?.total_logs ?? 0;
  const distinctRepos = stats?.distinct_repos ?? repos.length;

  const topRepos = [...repos].sort((a, b) => b.archive_size_bytes - a.archive_size_bytes).slice(0, 6);
  const maxSize = topRepos.length > 0 ? topRepos[0].archive_size_bytes : 1;

  const recentRuns = runs.slice(0, 4);
  const latestRepo = topRepos[0];

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.65fr)", gap: 28, marginBottom: 28, alignItems: "stretch" }}>
        <div className="card" style={{ padding: 28, position: "relative", overflow: "hidden", minHeight: 220 }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(26,26,26,0.03), rgba(192,57,43,0.03))", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 12 }}>
              BACKUP OPERATIONS
            </div>
            <h1 style={{ fontSize: 54, lineHeight: 1, marginBottom: 14 }}>
              Backup Observatory
            </h1>
            <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 720 }}>
              A PostgreSQL-backed overview of backup activity, repository sizes, run outcomes, and live worker health.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
              <span className="pill">PostgreSQL</span>
              <span className="pill">Execution logs</span>
              <span className="pill">Repo archive sizes</span>
              <span className="pill">Run history</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="stat-card" style={{ minHeight: 102 }}>
            <div className="stat-label">Latest run</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{latestRun ? latestRun.status : "No run yet"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{latestRun ? formatDate(latestRun.started_at) : "Waiting for the first backup"}</div>
          </div>
          <div className="stat-card" style={{ minHeight: 102 }}>
            <div className="stat-label">Largest repository</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {latestRepo?.full_name ?? stats?.largest_repository ?? "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatBytes(stats?.largest_archive_bytes ?? latestRepo?.archive_size_bytes ?? 0)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 16, marginBottom: 28 }}>
        <div className="stat-card"><div className="stat-label">Total runs</div><div className="stat-value">{stats?.total_runs ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Distinct repos</div><div className="stat-value">{distinctRepos}</div></div>
        <div className="stat-card"><div className="stat-label">Success rate</div><div className="stat-value">{stats?.success_rate ? `${stats.success_rate.toFixed(0)}%` : "—"}</div></div>
        <div className="stat-card"><div className="stat-label">Total size</div><div className="stat-value">{formatBytes(totalSize)}</div></div>
        <div className="stat-card"><div className="stat-label">Logs stored</div><div className="stat-value">{totalLogs}</div></div>
        <div className="stat-card"><div className="stat-label">Failures</div><div className="stat-value" style={{ color: "var(--danger)" }}>{failureCount}</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)", gap: 24, marginBottom: 28 }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="section-title">Run summary</div>
          <div className="section-desc">Stored totals from backup_runs, including skipped repositories and average duration.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
            <div className="card-flat"><div className="stat-label">Avg duration</div><div className="stat-value" style={{ fontSize: 22 }}>{stats?.avg_duration_ms ? formatDuration(stats.avg_duration_ms) : "—"}</div></div>
            <div className="card-flat"><div className="stat-label">Successful</div><div className="stat-value" style={{ fontSize: 22, color: "var(--success)" }}>{stats?.total_successful ?? 0}</div></div>
            <div className="card-flat"><div className="stat-label">Failed</div><div className="stat-value" style={{ fontSize: 22, color: "var(--danger)" }}>{failureCount}</div></div>
            <div className="card-flat"><div className="stat-label">Skipped</div><div className="stat-value" style={{ fontSize: 22 }}>{totalSkipped}</div></div>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div className="section-title">Storage profile</div>
          <div className="section-desc">Largest repositories by archive size, based on backup_results.</div>
          {topRepos.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "20px 0" }}>No repository snapshots yet</div>
          ) : (
            topRepos.map((repo, i) => {
              const pct = maxSize > 0 ? (repo.archive_size_bytes / maxSize) * 100 : 0;
              const colors = ["#c0392b", "#d4a017", "#27ae60", "#2980b9", "#8e44ad", "#7f8c8d"];
              return (
                <div key={repo.full_name} className="bar-row" style={{ padding: "8px 0" }}>
                  <div className="bar-label" style={{ minWidth: 220 }}>{repo.full_name}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                  </div>
                  <div className="bar-value">{formatBytes(repo.archive_size_bytes)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="section-title">Recent runs</div>
        <div className="section-desc">The latest persisted backup_runs entries, with outcomes and durations.</div>
        {recentRuns.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>No runs yet</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Status</th>
                  <th>Repos</th>
                  <th>Success</th>
                  <th>Failed</th>
                  <th>Skipped</th>
                  <th>Duration</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td>#{run.id}</td>
                    <td><span className={`badge ${run.status === "completed" ? "badge-success" : run.status === "running" ? "badge-running" : "badge-error"}`}>{run.status}</span></td>
                    <td>{run.total_repos}</td>
                    <td style={{ color: "var(--success)" }}>{run.successful}</td>
                    <td style={{ color: "var(--danger)" }}>{run.failed}</td>
                    <td>{run.skipped}</td>
                    <td>{formatDuration(run.duration_ms)}</td>
                    <td>{formatDate(run.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
