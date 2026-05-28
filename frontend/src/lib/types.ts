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
}

export interface WsMessage {
	 type: "log";
  id?: number;
  level?: string;
  message?: string;
  repository?: string;
  timestamp?: string;
}
