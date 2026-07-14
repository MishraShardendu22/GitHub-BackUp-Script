import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileCode,
  GitCommit,
  HardDrive,
  History,
  SkipForward,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { serverFetch } from "@/lib/server-api";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils";
import type { BackupResult, BackupRun } from "@/types";

interface BackupDetail {
  run: BackupRun;
  results: BackupResult[];
}

async function fetchBackupDetail(id: string): Promise<BackupDetail | null> {
  return serverFetch<BackupDetail>(`/api/backups/${id}`);
}

export default async function BackupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchBackupDetail(id);

  if (!data?.run) {
    notFound();
  }

  const { run, results = [] } = data;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="mb-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="mb-4 text-muted-foreground hover:text-foreground"
        >
          <Link href="/backups" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Backup History
          </Link>
        </Button>
      </div>

      <Card className="border-l-4 border-l-primary shadow-sm bg-gradient-to-br from-card to-primary/5">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-3 gap-2">
                <History className="h-3 w-3" />
                Backup Investigation
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                Run #{run.id}
              </h1>
              <div className="flex items-center gap-2 mt-2 text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md text-sm font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  Started {formatDate(run.started_at)}
                </span>
                <span className="text-border">•</span>
                <span className="text-sm font-medium">
                  {formatDuration(run.duration_ms)}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 bg-background/50 p-4 rounded-lg border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Run Status
              </span>
              <StatusBadge status={run.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background/60 border rounded-lg p-4 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5" /> Total Repos
              </span>
              <span className="text-2xl font-bold">{run.total_repos}</span>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-emerald-600/80 dark:text-emerald-400/80 uppercase flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Successful
              </span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                {run.successful}
              </span>
            </div>
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-destructive/80 uppercase flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" /> Failed
              </span>
              <span className="text-2xl font-bold text-destructive">
                {run.failed}
              </span>
            </div>
            <div className="bg-muted/30 border rounded-lg p-4 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <SkipForward className="h-3.5 w-3.5" /> Skipped
              </span>
              <span className="text-2xl font-bold text-muted-foreground">
                {run.skipped}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            Repository Investigation Logs
          </CardTitle>
          <CardDescription>
            Detailed results for all repositories processed in this run
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-4 opacity-50" />
              <p>No repository logs found for this run.</p>
            </div>
          ) : (
            <div className="w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repository</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Archive Size</TableHead>
                    <TableHead>Commit</TableHead>
                    <TableHead>Error Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow
                      key={result.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="font-medium text-foreground">
                        {result.repo_full_name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={result.status} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {result.archive_size_bytes > 0 ? (
                          <span className="flex items-center justify-end gap-1.5">
                            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatBytes(result.archive_size_bytes)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {result.commit_hash ? (
                          <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded w-fit">
                            <GitCommit className="h-3 w-3" />
                            {result.commit_hash.slice(0, 10)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        {result.error_message ? (
                          <div className="flex items-start gap-1.5 text-destructive bg-destructive/5 p-2 rounded-md border border-destructive/10">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span
                              className="text-sm truncate"
                              title={result.error_message}
                            >
                              {result.error_message}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
