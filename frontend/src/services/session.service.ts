import { fetchAPI } from "@/lib/api";
import type { MessageToolCall } from "@/types";

export interface Session {
  id: string;
  session_name: string;
  created_at: string;
  updated_at: string;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
  tool_calls?: MessageToolCall[];
}

export const sessionService = {
  getSessions: (token: string) =>
    fetchAPI<Session[]>("/sessions", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  createSession: (token: string, id: string, name: string) =>
    fetchAPI<Session>("/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, session_name: name }),
    }),

  getMessages: (token: string, sessionId: string) =>
    fetchAPI<SessionMessage[]>(`/sessions/${sessionId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteSession: (token: string, sessionId: string) =>
    fetchAPI<{ status: string }>(`/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  renameSession: (token: string, sessionId: string, newName: string) =>
    fetchAPI<Session>(`/sessions/${sessionId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ session_name: newName }),
    }),
};
