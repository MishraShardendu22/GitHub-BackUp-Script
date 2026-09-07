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
    <div className="page">
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-kicker">Backup Run Logs</div>
          <h1 className="page-title">Execution History</h1>
          <p className="page-subtitle">
            Complete history of all backup executions and their detailed
            results.
          </p>
        </div>
      </div>

      {!initialData ? (
        <div className="card">
          <p
            style={{
              color: "var(--danger)",
              padding: 40,
              textAlign: "center",
              fontSize: 15,
            }}
          >
            Failed to load backups. Please verify the backend is running.
          </p>
        </div>
      ) : (
        <BackupsClient initialData={initialData} />
      )}
    </div>
  );
}
