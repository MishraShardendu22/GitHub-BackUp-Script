import { AGENT_URL } from "@/config/env";
import { fetchAPI } from "@/lib/api";
import type {
  BackupFix,
  BackupResult,
  BackupRun,
  PaginatedResponse,
} from "@/types";

export const backupService = {
  getRuns: (page = 1, limit = 50) =>
    fetchAPI<PaginatedResponse<BackupRun>>(
      `/api/backups?page=${page}&limit=${limit}`,
    ),

  getRun: (id: number) =>
    fetchAPI<{ run: BackupRun; results: BackupResult[] }>(`/api/backups/${id}`),

  getLatest: () => fetchAPI<{ run: BackupRun | null }>("/api/backups/latest"),

  getFixes: () => fetchAPI<BackupFix[]>("/api/backup-fixes"),

  getFix: (id: number) => fetchAPI<BackupFix>(`/api/backup-fixes/${id}`),

  createFix: (data: {
    title: string;
    description: string;
    commitHash: string;
    author: string;
    affectedRuns: number[];
  }) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("agent_token")
        : null;

    return fetch(`${AGENT_URL}/backup-fixes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ detail: res.statusText }));
        throw new Error(error.detail || res.statusText);
      }
      return res.json() as Promise<BackupFix>;
    });
  },

  updateFix: (
    id: number,
    data: {
      title?: string;
      description?: string;
      commitHash?: string;
      author?: string;
      affectedRuns?: number[];
    },
  ) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("agent_token")
        : null;

    return fetch(`${AGENT_URL}/backup-fixes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ detail: res.statusText }));
        throw new Error(error.detail || res.statusText);
      }
      return res.json() as Promise<BackupFix>;
    });
  },

  getRunFixes: (id: number) =>
    fetchAPI<BackupFix[]>(`/api/backup-runs/${id}/fixes`),
};
