import {
  Clock,
  FileCode,
  FileText,
  GitCommit,
  HardDrive,
  Network,
} from "lucide-react";
import { AnalyticsSubNav } from "@/components/analytics/analytics-sub-nav";
import { PaginationBar } from "@/components/analytics/pagination-bar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { serverFetch } from "@/lib/server-api";
import { formatBytes, formatDate } from "@/lib/utils";
import type { RepoAnalyticsSnapshot } from "@/types";

interface SnapshotsResponse {
  data: RepoAnalyticsSnapshot[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

async function fetchSnapshots(
  page: number,
  pageSize: number,
): Promise<SnapshotsResponse | null> {
  return serverFetch<SnapshotsResponse>(
    `/api/analytics/history?page=${page}&page_size=${pageSize}`,
  );
}

export default async function SnapshotsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;

  const result = await fetchSnapshots(page, pageSize);
  const snapshots = result?.data || [];
  const pagination = result?.pagination;
  const latest = page === 1 && snapshots.length > 0 ? snapshots[0] : null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-3 gap-2">
            <GitCommit className="h-3 w-3" />
            Analytics / Git Snapshots
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Repository Snapshots
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Git metadata captured by the backend collector at each backup point
            — commits, branches, tags, blob sizes, and archive sizes.
          </p>
        </div>
        {snapshots.length > 0 && (
          <Badge variant="outline" className="px-3 py-1 font-medium bg-card">
            {pagination?.total_items || snapshots.length} snapshot
            {(pagination?.total_items || snapshots.length) !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <AnalyticsSubNav />

      {/* ── Latest snapshot summary ─────────────────────────────────── */}
      {latest && (
        <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Latest Snapshot</CardTitle>
                <CardDescription className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Captured {formatDate(latest.captured_at)}
                  </span>
                  {latest.head_commit && (
                    <>
                      <span className="text-border mx-1">•</span>
                      <span className="flex items-center gap-1.5 font-mono text-primary text-xs bg-primary/10 px-2 py-0.5 rounded">
                        <GitCommit className="h-3.5 w-3.5" />
                        {latest.head_commit.slice(0, 10)}
                      </span>
                    </>
                  )}
                  {latest.head_commit_message && (
                    <>
                      <span className="text-border mx-1">•</span>
                      <span
                        className="truncate max-w-[300px] text-muted-foreground text-sm"
                        title={latest.head_commit_message}
                      >
                        {latest.head_commit_message}
                      </span>
                    </>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background/50 border rounded-lg p-4 flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <GitCommit className="h-3.5 w-3.5" /> Total Commits
                </span>
                <span className="text-2xl font-bold">
                  {latest.total_commits}
                </span>
              </div>
              <div className="bg-background/50 border rounded-lg p-4 flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Network className="h-3.5 w-3.5" /> Branches
                </span>
                <span className="text-2xl font-bold">
                  {latest.branch_count}
                </span>
              </div>
              <div className="bg-background/50 border rounded-lg p-4 flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Tracked Files
                </span>
                <span className="text-2xl font-bold">
                  {latest.tracked_files}
                </span>
              </div>
              <div className="bg-background/50 border rounded-lg p-4 flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5" /> Total Archive Size
                </span>
                <span className="text-2xl font-bold text-primary">
                  {formatBytes(latest.total_archive_size_bytes)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── History table ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Snapshot History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!result ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load snapshots"
                message="Check that the backend API is running and accessible."
              />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No snapshots yet"
                description="Run the backup worker to start collecting repository analytics."
                icon={<FileCode className="h-8 w-8" />}
              />
            </div>
          ) : (
            <div className="flex flex-col">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Captured At</TableHead>
                    <TableHead>Commit</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="text-right">Commits</TableHead>
                    <TableHead className="text-right">Branches</TableHead>
                    <TableHead className="text-right">Tags</TableHead>
                    <TableHead className="text-right">Files</TableHead>
                    <TableHead className="text-right">Blob Size</TableHead>
                    <TableHead className="text-right">Archive Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((snap) => (
                    <TableRow key={snap.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(snap.captured_at)}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground text-xs">
                        {snap.head_commit ? snap.head_commit.slice(0, 10) : "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={snap.head_commit_message}
                      >
                        {snap.head_commit_message || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {snap.total_commits}
                      </TableCell>
                      <TableCell className="text-right">
                        {snap.branch_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {snap.tag_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {snap.tracked_files}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatBytes(snap.total_blob_size_bytes)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBytes(snap.total_archive_size_bytes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination && (
                <div className="p-4 border-t">
                  <PaginationBar
                    page={pagination.page}
                    totalPages={pagination.total_pages}
                    pageSize={pagination.page_size}
                    totalItems={pagination.total_items}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
