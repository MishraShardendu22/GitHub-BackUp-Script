import type { BackupRun } from "./backup";

export interface RepoAnalyticsSnapshot {
  id: number;
  run_id: number | null;
  captured_at: string;
  head_commit: string;
  head_commit_message: string;
  head_commit_at: string | null;
  total_commits: number;
  branch_count: number;
  tag_count: number;
  tracked_files: number;
  total_blob_size_bytes: number;
  avg_blob_size_bytes: number;
  largest_blob_path: string;
  largest_blob_size_bytes: number;
  archive_count: number;
  total_archive_size_bytes: number;
  avg_archive_size_bytes: number;
  largest_archive_path: string;
  largest_archive_size_bytes: number;
}

export interface MetricsData {
  runs: BackupRun[];
  total_runs: number;
  avg_duration_ms: number;
  total_successful: number;
  total_failed: number;
  total_skipped: number;
  distinct_repos: number;
  total_size_bytes?: number;
  largest_archive_bytes?: number;
  largest_repository?: string;
}
