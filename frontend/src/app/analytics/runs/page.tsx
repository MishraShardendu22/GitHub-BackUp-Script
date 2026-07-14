import { AlertCircle, ArrowRight, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { AnalyticsSubNav } from "@/components/analytics/analytics-sub-nav";
import { PaginationBar } from "@/components/analytics/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { serverFetch } from "@/lib/server-api";
import { formatDate, formatDuration } from "@/lib/utils";
import type { BackupRun } from "@/types";

interface RunsResponse {
  data: BackupRun[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

async function fetchRuns(
  page: number,
  pageSize: number,
): Promise<RunsResponse | null> {
  return serverFetch<RunsResponse>(
    `/api/backups?page=${page}&page_size=${pageSize}`,
  );
}

export default async function RunHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;

  const result = await fetchRuns(page, pageSize);
  const runs = result?.data || [];
  const pagination = result?.pagination;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-3 gap-2">
            <TerminalSquare className="h-3 w-3" />
            Analytics / Run History
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Backup Runs
          </h1>
          <p className="text-muted-foreground mt-1">
            Full paginated history of all backup runs. Click a run to see
            per-repository results.
          </p>
        </div>
      </div>

      <AnalyticsSubNav />

      <Card>
        <CardContent className="p-0">
          {!result ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-destructive">
              <AlertCircle className="h-8 w-8 mb-4 opacity-50" />
              <p className="font-semibold">Failed to load run history.</p>
              <p className="text-sm opacity-80 mt-1">
                Check the backend is running and accessible.
              </p>
            </div>
          ) : runs.length === 0 ? (
            <EmptyState
              title="No runs found"
              description="Start the backup worker to create a backup run."
              icon={<TerminalSquare className="h-8 w-8" />}
            />
          ) : (
            <div className="flex flex-col">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Run #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Repos</TableHead>
                    <TableHead className="text-right">✓ OK</TableHead>
                    <TableHead className="text-right">✗ Failed</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id} className="group">
                      <TableCell className="font-medium">#{run.id}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            run.status === "completed"
                              ? "default"
                              : run.status === "running"
                                ? "secondary"
                                : "destructive"
                          }
                          className={
                            run.status === "completed"
                              ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20"
                              : ""
                          }
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(run.started_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDuration(run.duration_ms)}
                      </TableCell>
                      <TableCell className="text-right">
                        {run.total_repos}
                      </TableCell>
                      <TableCell className="text-right text-emerald-500 font-medium">
                        {run.successful}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${run.failed > 0 ? "text-destructive" : ""}`}
                      >
                        {run.failed}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {run.skipped}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Link href={`/backups/${run.id}`}>
                            Details <ArrowRight className="h-4 w-4 ml-2" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination && (
                <div className="p-4 border-t border-border">
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
