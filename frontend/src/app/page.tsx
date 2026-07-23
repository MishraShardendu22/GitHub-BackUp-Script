import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { safeFetch } from "@/lib/api";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils";
import type { BackupRun } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Dashboard Overview",
  description:
    "Overview dashboard of GitHub backup runs, repository statistics, archive sizes, and worker execution logs.",
  alternates: {
    canonical: "/",
  },
};

interface DashboardStats {
  total_runs: number;
  total_repos: number;
  total_successful: number;
  success_rate: number;
  last_run_status: string;
  last_run_at: string | null;
  total_failed: number;
  avg_duration_ms: number;
  total_skipped: number;
  distinct_repos: number;
  total_logs: number;
  total_size_bytes: number;
  largest_archive_bytes: number;
  largest_repository: string;
  latest_analytics: unknown;
}

async function fetchStats(): Promise<DashboardStats | null> {
  return safeFetch<DashboardStats>("/api/dashboard/stats");
}

async function fetchLatestRun(): Promise<BackupRun | null> {
  const data = await safeFetch<{ run: BackupRun | null }>("/api/backups/latest");
  return data?.run || null;
}

export default async function DashboardPage() {
  const [stats, latestRun] = await Promise.all([fetchStats(), fetchLatestRun()]);

  return (
    <div className="page">

      {/* ── Hero / Status Block ───────────────────────────────────────── */}
      <section
        className="card section-card reveal"
        style={{
          borderTop: "2px solid var(--accent)",
          padding: "40px 48px",
        }}
      >
        <div className="page-head" style={{ marginBottom: 32 }}>
          <div>
            <div className="page-kicker">Backup Operations Overview</div>
            <h1 className="page-title">
              System<br /><em>Status</em>
            </h1>
            <p className="page-subtitle">
              Real-time monitoring of GitHub repository backups, worker health,
              and system storage.
            </p>
          </div>

          {latestRun && (
            <div
              style={{
                textAlign: "right",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Last Execution
              </div>
              <StatusBadge status={latestRun.status} />
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {formatDate(latestRun.started_at)}
              </div>
            </div>
          )}
        </div>

        <div className="metric-grid metric-grid--four stats-grid">
          <div className="stat-card reveal reveal-delay-1">
            <div className="stat-label">Total Repos Tracked</div>
            <div className="stat-value">{stats?.distinct_repos ?? 0}</div>
          </div>
          <div className="stat-card reveal reveal-delay-2">
            <div className="stat-label">Total Backup Size</div>
            <div className="stat-value stat-value--md">
              {formatBytes(stats?.total_size_bytes ?? 0)}
            </div>
          </div>
          <div className="stat-card reveal reveal-delay-3">
            <div className="stat-label">System Success Rate</div>
            <div className="stat-value stat-value--success">
              {stats?.success_rate && stats.success_rate > 0
                ? `${stats.success_rate.toFixed(1)}%`
                : "—"}
            </div>
          </div>
          <div className="stat-card reveal reveal-delay-4">
            <div className="stat-label">Total Executions</div>
            <div className="stat-value">{stats?.total_runs ?? 0}</div>
          </div>
        </div>
      </section>

      {/* ── KPI Tiles ────────────────────────────────────────────────── */}
      <div className="metric-grid metric-grid--four stats-grid">
        <div className="stat-card reveal reveal-delay-1">
          <div className="stat-label">Avg Run Duration</div>
          <div className="stat-value">
            {stats?.avg_duration_ms ? formatDuration(stats.avg_duration_ms) : "—"}
          </div>
        </div>
        <div className="stat-card reveal reveal-delay-2">
          <div className="stat-label">Successful Repos</div>
          <div className="stat-value stat-value--success">
            {stats?.total_successful ?? 0}
          </div>
        </div>
        <div className="stat-card reveal reveal-delay-3">
          <div className="stat-label">Failed Repos</div>
          <div className="stat-value stat-value--danger">
            {stats?.total_failed ?? 0}
          </div>
        </div>
        <div className="stat-card reveal reveal-delay-4">
          <div className="stat-label">Logs Processed</div>
          <div className="stat-value">{stats?.total_logs ?? 0}</div>
        </div>
      </div>

      {/* ── Latest Run Quick-Card ─────────────────────────────────────── */}
      {latestRun && (
        <section className="card section-card reveal" style={{ padding: "32px 40px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 24,
              paddingBottom: 24,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-sans)",
                  marginBottom: 8,
                }}
              >
                Latest Run
              </div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 22,
                  fontWeight: 400,
                  color: "var(--text)",
                  letterSpacing: "-0.015em",
                  lineHeight: 1.2,
                  marginBottom: 6,
                }}
              >
                Backup run #{latestRun.id}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Started {formatDate(latestRun.started_at)} ·{" "}
                {formatDuration(latestRun.duration_ms)}
              </div>
            </div>
            <Link
              href={`/backups/${latestRun.id}`}
              className="btn btn-outline"
              style={{ fontSize: 13, marginTop: 4 }}
            >
              View full results →
            </Link>
          </div>

          <div className="metric-grid metric-grid--four">
            <div className="card-flat">
              <div className="stat-label">Repos backed up</div>
              <div className="stat-value stat-value--md">{latestRun.total_repos}</div>
            </div>
            <div className="card-flat">
              <div className="stat-label">Successful</div>
              <div className="stat-value stat-value--md stat-value--success">
                {latestRun.successful}
              </div>
            </div>
            <div className="card-flat">
              <div className="stat-label">Failed</div>
              <div
                className="stat-value stat-value--md"
                style={{
                  color: latestRun.failed > 0 ? "var(--danger)" : "inherit",
                }}
              >
                {latestRun.failed}
              </div>
            </div>
            <div className="card-flat">
              <div className="stat-label">Skipped</div>
              <div className="stat-value stat-value--md" style={{ color: "var(--text-muted)" }}>
                {latestRun.skipped}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Navigation Cards ──────────────────────────────────────────── */}
      <div className="metric-grid metric-grid--four">
        <NavCard
          href="/backups"
          title="Backup History"
          desc="All past runs and per-repo results"
          kicker="Archive"
          icon={<path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />}
        />
        <NavCard
          href="/analytics"
          title="Analytics"
          desc="Charts and trend overview"
          kicker="Insights"
          icon={
            <>
              <path d="M3 3v18h18" />
              <path d="M7 16l4-4 4 4 4-6" />
            </>
          }
        />
        <NavCard
          href="/analytics/runs"
          title="Run History"
          desc="Full paginated run table"
          kicker="Logs"
          icon={
            <>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </>
          }
        />
        <NavCard
          href="/analytics/snapshots"
          title="Git Snapshots"
          desc="Repository analytics history"
          kicker="Repos"
          icon={
            <>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
            </>
          }
        />
      </div>

    </div>
  );
}

function NavCard({
  href,
  title,
  desc,
  kicker,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  kicker: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <div
        className="card reveal nav-card"
        style={{
          padding: "28px 32px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          height: "100%",
        }}
      >
        {/* Icon badge */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--accent-bg)",
            border: "1px solid rgba(139, 124, 255, 0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {icon}
          </svg>
        </div>

        {/* Text */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
              fontFamily: "var(--font-sans)",
              marginBottom: 6,
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: 20,
              color: "var(--text)",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              marginBottom: 6,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-sans)",
              lineHeight: 1.55,
            }}
          >
            {desc}
          </div>
        </div>
      </div>
    </Link>
  );
}
