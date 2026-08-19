export type Role = "user" | "assistant";

export interface MessageToolCall {
  name: string;
  args: Record<string, unknown>;
  success: boolean;
  running: boolean;
  duration_ms: number | null;
  result?: unknown;
  error?: string;
}

export interface SearchSource {
  id?: number | string;
  source_type: string;
  source_id: string;
  content: string;
  score: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
  timestamp: Date;
  toolCalls?: MessageToolCall[];
  sources?: SearchSource[];
  iteration?: number;
}

export interface StreamEvent {
  type:
    | "info"
    | "agent_reasoning"
    | "confirm_required"
    | "tool_start"
    | "tool_end"
    | "token"
    | "done";
  iteration?: number;
  sources?: SearchSource[];
  confirm_id?: string;
  name?: string;
  args?: Record<string, unknown>;
  success?: boolean;
  duration_ms?: number;
  result?: unknown;
  error?: string;
  text?: string;
  answer?: string;
}
