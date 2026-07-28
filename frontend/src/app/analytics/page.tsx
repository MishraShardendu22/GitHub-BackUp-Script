import Link from "next/link";
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { AnalyticsSubNav } from "@/components/analytics/analytics-sub-nav";
import { DaySelector } from "@/components/analytics/day-selector";
import { serverFetch } from "@/lib/server-api";
import { formatBytes, formatDuration } from "@/lib/utils";
import type { MetricsData } from "@/types";

const DAY_OPTIONS = [7, 14, 30, 90] as const;

async function fetchMetrics(days: number): Promise<MetricsData | null> {
  return serverFetch<MetricsData>(`/api/metrics?days=${days}`);
}

export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = Number(params.days) || 30;
  const metrics = await fetchMetrics(days);

  const hasData = metrics?.runs && metrics.runs.length > 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Analytics</div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
            Backup performance trends over time. Use the tabs below to browse
            detailed run history or Git snapshot records.
          </p>
        </div>

        <DaySelector currentDays={days} options={DAY_OPTIONS} />
      </div>

      <AnalyticsSubNav />

      {/* -- Stats ------------------------------------------------------- */}
      {!hasData ? (
        <InsufficientData days={days} />
      ) : (
        <div className="metric-grid metric-grid--four stats-grid">
          <div className="stat-card">
            <div className="stat-label">Runs in {days}d window</div>
            <div className="stat-value">{metrics?.total_runs ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg duration</div>
            <div className="stat-value">
              {metrics?.avg_duration_ms
                ? formatDuration(metrics.avg_duration_ms)
                : "—"}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Successful</div>
            <div className="stat-value stat-value--success">
              {metrics?.total_successful ?? 0}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Failed</div>
            <div className="stat-value stat-value--danger">
              {metrics?.total_failed ?? 0}
            </div>
          </div>
        </div>
      )}

      {/* -- Charts ------------------------------------------------------ */}
      {hasData && metrics?.runs && (
        <AnalyticsCharts data={metrics.runs} days={days} />
      )}

      {/* -- Storage summary (only on overview) --------------------------- */}
      {metrics && (
        <div className="split-grid">
          {/* Storage card */}
          <div className="card section-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--accent-bg)",
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
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                  <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 0 }}>
                  Storage
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  Last {days} days
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <StorageStat
                label="Total size"
                value={formatBytes(metrics.total_size_bytes ?? 0)}
                accent
              />
              <StorageStat
                label="Largest archive"
                value={formatBytes(metrics.largest_archive_bytes ?? 0)}
              />
              <StorageStat
                label="Distinct repos"
                value={String(metrics.distinct_repos ?? 0)}
              />
              <StorageStat
                label="Largest repo"
                value={metrics.largest_repository || "—"}
                truncate
              />
            </div>
          </div>

          {/* Dive deeper card */}
          <div className="card section-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--accent-bg)",
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
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                  <path d="M11 8v6M8 11h6" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 0 }}>
                  Explore
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  Detailed historical data
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 7 }}>
              <DiveLink
                href="/analytics/runs"
                label="Run History"
                desc="Full paginated table of all backup runs"
                icon={
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </>
                }
              />
              <DiveLink
                href="/analytics/snapshots"
                label="Git Snapshots"
                desc="Repository analytics at each backup point"
                icon={
                  <>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
                  </>
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InsufficientData({ days }: { days: number }) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderRadius: 8,
        background: "rgba(139, 92, 246, 0.06)",
        border: "1px solid rgba(139, 92, 246, 0.18)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <p
          style={{
            fontWeight: 600,
            fontSize: 14.5,
            color: "var(--text-secondary)",
          }}
        >
          No data for the {days}-day window
        </p>
        <p style={{ fontSize: 13, marginTop: 4, color: "var(--text-muted)" }}>
          No backup runs were recorded in the last {days} days. Try a longer
          range or start the backup worker.
        </p>
      </div>
    </div>
  );
}

function StorageStat({
  label,
  value,
  accent,
  truncate,
}: {
  label: string;
  value: string;
  accent?: boolean;
  truncate?: boolean;
}) {
  return (
    <div
      style={{
        background: accent
          ? "linear-gradient(135deg, rgba(139, 92, 246, 0.10), rgba(139, 92, 246, 0.02))"
          : "rgba(255,255,255,0.03)",
        border: accent
          ? "1px solid rgba(139, 92, 246, 0.20)"
          : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 7,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: accent ? "var(--accent)" : "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: truncate ? "nowrap" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DiveLink({
  href,
  label,
  desc,
  icon,
}: {
  href: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="dive-link"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 7,
        textDecoration: "none",
        transition: "background 0.15s",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, opacity: 0.7 }}
        aria-hidden="true"
      >
        {icon}
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {label}
        </div>
        <div
          style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}
        >
          {desc}
        </div>
      </div>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}
