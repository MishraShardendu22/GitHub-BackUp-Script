import { AGENT_URL } from "@/config/env";

interface ToolStat {
  name: string;
  count: number;
  avg_duration: number;
  success_count: number;
  success_rate: number;
}

interface DashboardStats {
  total_conversations: number;
  total_agent_runs: number;
  success_rate: number;
  tool_usage: ToolStat[];
  memory_stats: { total_messages: number };
  recent_activity: {
    request_id: string;
    question: string;
    status: string;
    created_at: string;
  }[];
  system_health: { database: string; status: string };
  model_name?: string;
}

export const statsService = {
  async get(token?: string | null): Promise<DashboardStats | null> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const res = await fetch(`${AGENT_URL}/stats`, { headers });
      if (!res.ok) return null;

      const data = await res.json();
      return data.data;
    } catch {
      return null;
    }
  },
};
