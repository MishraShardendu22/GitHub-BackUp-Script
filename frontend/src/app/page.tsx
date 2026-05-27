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
  const totalSize = repos.reduce((a, r) => a + (r.archive_size_bytes || 0), 0);
  const failureCount = stats?.total_failed ?? 0;

  // Sort repos by size for the bar chart
  const topRepos = [...repos].sort((a, b) => b.archive_size_bytes - a.archive_size_bytes).slice(0, 5);
  const maxSize = topRepos.length > 0 ? topRepos[0].archive_size_bytes : 1;

  return (
    <div>
      {/* Hero Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 40, marginBottom: 48 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>
            STATUS: BACKUP / LIVE SSR
          </div>
          <h1 style={{ fontSize: 48, fontFamily: "var(--font-serif)", lineHeight: 1.1, marginBottom: 16 }}>
            Backup Observatory
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 480 }}>
            Monitor backup metrics and failures from the latest stored data. Every request is server-rendered to keep the view current.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <span className="pill">PostgreSQL</span>
            <span className="pill">Fiber API</span>
            <span className="pill">AI briefing</span>
          </div>
        </div>

        {/* Latest Snapshot Card */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Latest snapshot</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
            {latestRun ? formatDate(latestRun.started_at) : "No backups yet"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: 10 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Repos captured</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{latestRun?.total_repos ?? 0}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: 10 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total size</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{formatBytes(totalSize)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Success rate</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{stats?.success_rate ? `${stats.success_rate.toFixed(0)}%` : "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Snapshot */}
      <div style={{ marginBottom: 48 }}>
        <div className="section-title">Operational snapshot</div>
        <div className="section-desc">Metrics derived from stored snapshot and failure data.</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <div className="stat-card">
            <div className="stat-label">Repos Tracked</div>
            <div className="stat-value">{repos.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Size</div>
            <div className="stat-value">{formatBytes(totalSize)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Runs</div>
            <div className="stat-value">{stats?.total_runs ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Failures</div>
            <div className="stat-value">{failureCount}</div>
          </div>
        </div>
      </div>

      {/* Snapshot Pulse */}
      <div style={{ marginBottom: 48 }}>
        <div className="section-title">Snapshot pulse</div>
        <div className="section-desc">Quick view of the largest repositories in the latest snapshots.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Largest Repos */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Largest repositories</div>
            {topRepos.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "20px 0" }}>No data yet</div>
            ) : (
              topRepos.map((repo, i) => {
                const pct = maxSize > 0 ? (repo.archive_size_bytes / maxSize) * 100 : 0;
                const colors = ["#c0392b", "#d4a017", "#27ae60", "#2980b9", "#8e44ad"];
                return (
                  <div key={repo.full_name} className="bar-row">
                    <div className="bar-label">{repo.full_name}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                    </div>
                    <div className="bar-value">{formatBytes(repo.archive_size_bytes)}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Recent Runs */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Recent runs</div>
            {runs.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "20px 0" }}>No runs yet</div>
            ) : (
              runs.map((run) => (
                <div key={run.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      className={`badge ${run.status === "completed" ? "badge-success" : run.status === "running" ? "badge-running" : "badge-error"}`}
                    >
                      {run.status}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {run.successful}/{run.total_repos} repos
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDuration(run.duration_ms)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
