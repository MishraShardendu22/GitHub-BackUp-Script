import {
  ChevronRight,
  Database,
  GitCommit,
  History,
  Info,
  Search,
} from "lucide-react";
import Link from "next/link";
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { AnalyticsSubNav } from "@/components/analytics/analytics-sub-nav";
import { DaySelector } from "@/components/analytics/day-selector";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeFetch } from "@/lib/api";
import { cn, formatBytes, formatDuration } from "@/lib/utils";
import type { MetricsData } from "@/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytics",
  description: "Repository storage and execution metrics over time.",
};

async function getAnalyticsData(days: number): Promise<MetricsData | null> {
  return safeFetch<MetricsData>(`/api/analytics?days=${days}`);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const resolvedParams = await searchParams;
  const days = Number.parseInt(resolvedParams.days || "30", 10);
  const metrics = await getAnalyticsData(days);

  const hasData = metrics && metrics.total_runs > 0;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-3">
            System Analytics
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Analytics Overview
          </h1>
          <p className="text-muted-foreground mt-1">
            Storage utilization and execution metrics over the last {days} days.
          </p>
        </div>
        <DaySelector currentDays={days} />
      </div>

      <AnalyticsSubNav />

      {/* ── Overview Metrics ──────────────────────────────────────────── */}
      {!hasData && <InsufficientData days={days} />}

      {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Total Executions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {metrics?.total_runs ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Avg Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {metrics?.avg_duration_ms
                  ? formatDuration(metrics.avg_duration_ms)
                  : "—"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold tracking-wide text-emerald-500/80 uppercase">
                Successful
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-500">
                {metrics?.total_successful ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold tracking-wide text-destructive/80 uppercase">
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                {metrics?.total_failed ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Charts ────────────────────────────────────────────────────── */}
      {hasData && metrics?.runs && (
        <AnalyticsCharts data={metrics.runs} days={days} />
      )}

      {/* ── Storage summary (only on overview) ─────────────────────────── */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Storage card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Storage</CardTitle>
                  <CardDescription>Last {days} days</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
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
            </CardContent>
          </Card>

          {/* Dive deeper card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Explore</CardTitle>
                  <CardDescription>Detailed historical data</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <DiveLink
                  href="/analytics/runs"
                  label="Run History"
                  desc="Full paginated table of all backup runs"
                  icon={<History className="h-5 w-5" />}
                />
                <DiveLink
                  href="/analytics/snapshots"
                  label="Git Snapshots"
                  desc="Repository analytics at each backup point"
                  icon={<GitCommit className="h-5 w-5" />}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function InsufficientData({ days }: { days: number }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
      <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div>
        <h4 className="text-sm font-semibold text-foreground">
          No data for the {days}-day window
        </h4>
        <p className="text-sm text-muted-foreground mt-1">
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
      className={cn(
        "flex flex-col gap-1 p-3 rounded-lg border",
        accent
          ? "bg-primary/5 border-primary/20"
          : "bg-muted/30 border-border/50",
      )}
    >
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div
        className={cn(
          "text-lg font-semibold",
          accent ? "text-primary" : "text-foreground",
          truncate && "truncate",
        )}
        title={truncate ? value : undefined}
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
      className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="text-muted-foreground group-hover:text-primary transition-colors">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground group-hover:text-accent-foreground/80">
            {desc}
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}
