import { History } from "lucide-react";
import BackupsClient from "@/components/backups/BackupsClient";
import { serverFetch } from "@/lib/server-api";
import type { BackupRun } from "@/types";

interface BackupsResponse {
  data: BackupRun[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}

async function fetchBackups(
  page: number,
  pageSize: number,
): Promise<BackupsResponse | null> {
  return serverFetch<BackupsResponse>(
    `/api/backups?page=${page}&limit=${pageSize}`,
  );
}

export default async function BackupsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 25;

  const result = await fetchBackups(page, pageSize);

  const initialData = result
    ? {
        data: result.data || [],
        pagination: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total_items: result.pagination.total_items,
          total_pages: result.pagination.total_pages,
        },
      }
    : null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-3 gap-2">
            <History className="h-3 w-3" />
            Backup Run Logs
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Execution History
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Complete history of all backup executions and their detailed
            results.
          </p>
        </div>
      </div>

      {!initialData ? (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <History className="h-12 w-12 text-destructive mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-destructive">
            Failed to load backups
          </h3>
          <p className="text-muted-foreground mt-2">
            Please verify the backend is running and accessible.
          </p>
        </div>
      ) : (
        <BackupsClient initialData={initialData} />
      )}
    </div>
  );
}
