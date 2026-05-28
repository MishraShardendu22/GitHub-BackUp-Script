export interface BackupRun {
  id: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_repos: number;
  successful: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  error_message: string;
}

export interface BackupResult {
  id: number;
  run_id: number;
  repo_full_name: string;
  status: string;
  commit_hash: string;
  archive_size_bytes: number;
  duration_ms: number;
  error_message: string;
  created_at: string;
}

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

export interface ExecutionLog {
  id: number;
  run_id: number | null;
  level: string;
  message: string;
  repository: string;
  created_at: string;
}

export interface DashboardStats {
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
  latest_analytics: RepoAnalyticsSnapshot | null;
}

export interface LiveStatus {
  worker_running: boolean;
  run?: {
    id: number;
    status: string;
    total_repos: number;
    successful: number;
    failed: number;
    skipped: number;
    started_at: string;
  };
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  tokens_used: number;
  web_search: boolean;
  created_at: string;
  sources?: ChatSource[];
}

export interface ChatSource {
  label: string;
  url: string;
  content?: string;
}

export interface ReportMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface ReportRepository {
  name: string;
  status: string;
  commit_hash: string;
  archive_size_bytes: number;
  archive_size: string;
  created_at: string;
}

export interface ReportFailure {
  repository: string;
  message: string;
  created_at: string;
}

export interface ReportRunSnapshot {
  id: number;
  status: string;
  started_at: string;
  completed_at?: string;
  total_repos: number;
  successful: number;
  failed: number;
  skipped: number;
  duration_ms: number;
}

export interface ReportAnalyticsSnapshot {
  captured_at: string;
  head_commit: string;
  head_commit_message: string;
  head_commit_at?: string;
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

export interface ReportBundle {
  generated_at: string;
  report_type: string;
  subject: string;
  headline: string;
  summary: string;
  ai_insights?: string[];
  metrics: ReportMetric[];
  findings: string[];
  next_steps: string[];
  risks: string[];
  questions: string[];
  repositories: ReportRepository[];
  failures: ReportFailure[];
  run: ReportRunSnapshot;
  analytics?: ReportAnalyticsSnapshot;
}

export interface RepoInfo {
  full_name: string;
  last_status: string;
  last_commit_hash: string;
  archive_size_bytes: number;
  last_backed_up: string;
}

export interface MetricsData {
  runs: BackupRun[];
  total_runs: number;
  avg_duration_ms: number;
  total_successful: number;
  total_failed: number;
  total_skipped: number;
  distinct_repos: number;
  total_logs: number;
  total_size_bytes: number;
  largest_archive_bytes: number;
  largest_repository: string;
  latest_analytics: RepoAnalyticsSnapshot | null;
}

export interface WsMessage {
  type: "log";
  id?: number;
  level?: string;
  message?: string;
  repository?: string;
  timestamp?: string;
}
