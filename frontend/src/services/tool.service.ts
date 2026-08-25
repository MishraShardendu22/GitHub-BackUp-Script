import { AGENT_URL } from "@/config/env";

export interface AgentToolDefinition {
  name: string;
  description: string;
  args_schema: Record<string, unknown>;
}

export interface ToolExecutionResult {
  name: string;
  args: Record<string, unknown>;
  success: boolean;
  duration_ms: number;
  result: unknown;
  error: string | null;
}

export interface ToolCallStat {
  invocations: number;
  total_duration_ms: number;
  avg_duration_ms: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
}

export interface ObservatoryStats {
  total_sessions: number;
  total_messages: number;
  total_investigations: number;
  total_tool_calls: number;
  tool_stats: Record<string, ToolCallStat>;
}

export const toolService = {
  async fetchTools(): Promise<AgentToolDefinition[]> {
    try {
      const res = await fetch(`${AGENT_URL}/api/tools`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch (e) {
      console.warn("Failed to fetch agent tools:", e);
      return [];
    }
  },

  async executeTool(
    token: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<ToolExecutionResult> {
    const res = await fetch(`${AGENT_URL}/api/tools/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tool_name: toolName,
        args,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorMsg = `HTTP error ${res.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.detail || errorJson.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      return {
        name: toolName,
        args,
        success: false,
        duration_ms: 0,
        result: null,
        error: errorMsg,
      };
    }

    const json = await res.json();
    return (
      json.data || {
        name: toolName,
        args,
        success: true,
        duration_ms: 0,
        result: json,
        error: null,
      }
    );
  },

  async fetchStats(token?: string | null): Promise<ObservatoryStats | null> {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${AGENT_URL}/stats`, { headers });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || json;
    } catch (e) {
      console.warn("Failed to fetch observatory stats:", e);
      return null;
    }
  },
};
