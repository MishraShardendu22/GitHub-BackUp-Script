import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  GitCommit,
  HardDrive,
  History,
  TerminalSquare,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
  const data = await safeFetch<{ run: BackupRun | null }>(
    "/api/backups/latest",
  );
  return data?.run || null;
}

export default async function DashboardPage() {
  const [stats, latestRun] = await Promise.all([
    fetchStats(),
    fetchLatestRun(),
  ]);

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* ── Hero / Status Block ───────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/30" />

        <div className="relative p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Backup Operations Overview
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              System Status
            </h1>
            <p className="text-lg text-muted-foreground max-w-[600px] leading-relaxed">
              Real-time monitoring of GitHub repository backups, worker health,
              and system storage.
            </p>
          </div>
          {latestRun && (
            <div className="flex flex-col items-start md:items-end p-4 rounded-lg bg-background/50 border backdrop-blur-sm shadow-sm shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Last Execution
              </span>
              <StatusBadge status={latestRun.status} />
              <span className="text-sm font-medium text-foreground mt-3">
                {formatDate(latestRun.started_at)}
              </span>
            </div>
          )}
        </div>

        <div className="relative border-t bg-background/40 backdrop-blur-sm p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Repos Tracked"
              value={stats?.distinct_repos ?? 0}
              icon={<Database className="h-5 w-5 text-primary" />}
            />
            <StatCard
              title="Total Backup Size"
              value={formatBytes(stats?.total_size_bytes ?? 0)}
              icon={<HardDrive className="h-5 w-5 text-primary" />}
            />
            <StatCard
              title="System Success Rate"
              value={
                stats?.success_rate && stats.success_rate > 0
                  ? `${stats.success_rate.toFixed(1)}%`
                  : "—"
              }
              valueClassName="text-emerald-500"
              icon={<Activity className="h-5 w-5 text-emerald-500" />}
            />
            <StatCard
              title="Total Executions"
              value={stats?.total_runs ?? 0}
              icon={<TerminalSquare className="h-5 w-5 text-primary" />}
            />
          </div>
        </div>
      </section>

      {/* ── KPI tiles ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Avg Run Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.avg_duration_ms
                ? formatDuration(stats.avg_duration_ms)
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Successful Repos
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-500">
              {stats?.total_successful ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Failed Repos
            </CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {stats?.total_failed ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Logs Processed
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_logs ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Latest run quick-card ─────────────────────────────────────── */}
      {latestRun && (
        <Card className="overflow-hidden">
          <div className="border-b bg-muted/40 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Latest backup run — #{latestRun.id}
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-2">
                Started {formatDate(latestRun.started_at)}{" "}
                <span className="text-border">•</span>{" "}
                {formatDuration(latestRun.duration_ms)}
              </p>
            </div>
            <Button
              variant="outline"
              asChild
              size="sm"
              className="shrink-0 gap-2 font-medium"
            >
              <Link href={`/backups/${latestRun.id}`}>
                View full results <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x-0 lg:divide-x">
            <div className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Repos backed up
              </div>
              <div className="text-3xl font-bold">{latestRun.total_repos}</div>
            </div>
            <div className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Successful
              </div>
              <div className="text-3xl font-bold text-emerald-500">
                {latestRun.successful}
              </div>
            </div>
            <div className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Failed
              </div>
              <div
                className={`text-3xl font-bold ${latestRun.failed > 0 ? "text-destructive" : ""}`}
              >
                {latestRun.failed}
              </div>
            </div>
            <div className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Skipped
              </div>
              <div className="text-3xl font-bold text-muted-foreground">
                {latestRun.skipped}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Navigation cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <NavCard
          href="/backups"
          title="Backup History"
          desc="All past runs and per-repo results"
          icon={<History className="h-5 w-5 text-primary" />}
        />
        <NavCard
          href="/analytics"
          title="Analytics"
          desc="Charts and trend overview"
          icon={<Activity className="h-5 w-5 text-primary" />}
        />
        <NavCard
          href="/analytics/runs"
          title="Run History"
          desc="Full paginated run table"
          icon={<TerminalSquare className="h-5 w-5 text-primary" />}
        />
        <NavCard
          href="/analytics/snapshots"
          title="Git Snapshots"
          desc="Repository analytics history"
          icon={<GitCommit className="h-5 w-5 text-primary" />}
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  valueClassName = "",
  icon,
}: {
  title: string;
  value: string | number;
  valueClassName?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      <span
        className={`text-3xl md:text-4xl font-bold tracking-tight ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function NavCard({
  href,
  title,
  desc,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="block group h-full">
      <Card className="h-full transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:bg-accent/5">
        <CardContent className="p-6 flex flex-col gap-4 h-full">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {desc}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
