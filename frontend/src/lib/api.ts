const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }

  return res.json();
}

// Backups
export const getBackupRuns = (limit = 20, offset = 0) =>
  fetchAPI<import("./types").BackupRun[]>(`/api/backups?limit=${limit}&offset=${offset}`);

export const getBackupRun = (id: number) =>
  fetchAPI<{ run: import("./types").BackupRun; results: import("./types").BackupResult[] }>(`/api/backups/${id}`);

export const getLatestBackup = () =>
  fetchAPI<{ run: import("./types").BackupRun | null }>("/api/backups/latest");

// Dashboard
export const getDashboardStats = () =>
  fetchAPI<import("./types").DashboardStats>("/api/dashboard/stats");

// Metrics
export const getMetrics = (days = 30) =>
  fetchAPI<import("./types").MetricsData>(`/api/metrics?days=${days}`);

// Logs
export const getLogs = (limit = 100, level?: string, runId?: string) => {
  let url = `/api/logs?limit=${limit}`;
  if (level) url += `&level=${level}`;
  if (runId) url += `&run_id=${runId}`;
  return fetchAPI<import("./types").ExecutionLog[]>(url);
};

// Repos
export const getRepos = () =>
  fetchAPI<import("./types").RepoInfo[]>("/api/repos");

// AI
export const postChat = (message: string, conversationId?: number, webSearch = false) =>
  fetchAPI<{ conversation_id: number; message: string; tokens_used: number; web_search: boolean; model: string; sources?: import("./types").ChatSource[] }>(
    "/api/ai/chat",
    {
      method: "POST",
      body: JSON.stringify({ message, conversation_id: conversationId, web_search: webSearch }),
    }
  );

export const getConversations = () =>
  fetchAPI<import("./types").Conversation[]>("/api/ai/conversations");

export const getConversation = (id: number) =>
  fetchAPI<import("./types").ChatMessage[]>(`/api/ai/conversations/${id}`);

export const deleteConversation = (id: number) =>
  fetchAPI<{ deleted: boolean }>(`/api/ai/conversations/${id}`, { method: "DELETE" });

// Reports
export const getLatestReport = (reportType = "latest") =>
  fetchAPI<import("./types").ReportBundle>("/api/reports/latest", {
    method: "POST",
    body: JSON.stringify({ report_type: reportType }),
  });

export const sendReport = (reportType: string) =>
  fetchAPI<{ sent: boolean; subject: string; to: string; report?: import("./types").ReportBundle }>("/api/reports/send", {
    method: "POST",
    body: JSON.stringify({ report_type: reportType }),
  });

export const getReportHistory = () =>
  fetchAPI<Array<{ id: number; report_type: string; recipients: string; subject: string; status: string; sent_at: string }>>("/api/reports/history");

// System
export const getSystemHealth = () =>
  fetchAPI<{ status: string; database: boolean; worker_running: boolean; current_run_id: number | null }>("/api/system/health");

export const getLiveStatus = () =>
  fetchAPI<import("./types").LiveStatus>("/api/system/live");
