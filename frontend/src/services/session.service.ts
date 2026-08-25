import { AGENT_URL } from "@/config/env";

interface Session {
  id: string;
  session_name: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  tool_calls?: Record<string, unknown>[];
}

export const sessionService = {
  async list(token?: string | null): Promise<Session[]> {
    if (!token) {
      return [];
    }

    try {
      const res = await fetch(`${AGENT_URL}/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
        return [];
      }

      const data = await res.json();
      return data.data || [];
    } catch {
      // Backend is starting up, unreachable, or offline
      return [];
    }
  },

  async create(token: string, id: string, name: string): Promise<void> {
    if (!token) return;

    try {
      const res = await fetch(`${AGENT_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, session_name: name }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
        const errText = await res.text().catch(() => "");
        throw new Error(`Failed to create session: ${res.status} ${errText}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Failed to create")) {
        throw err;
      }
      throw new Error("Unable to connect to Agent Observatory service.");
    }
  },

  async rename(token: string, id: string, name: string): Promise<void> {
    if (!token) return;

    try {
      const res = await fetch(`${AGENT_URL}/sessions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_name: name.trim() }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
        const errText = await res.text().catch(() => "");
        throw new Error(`Failed to rename session: ${res.status} ${errText}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Failed to rename")) {
        throw err;
      }
      throw new Error("Unable to connect to Agent Observatory service.");
    }
  },

  async delete(token: string, id: string): Promise<void> {
    if (!token) return;

    try {
      const res = await fetch(`${AGENT_URL}/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
        const errText = await res.text().catch(() => "");
        throw new Error(`Failed to delete session: ${res.status} ${errText}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Failed to delete")) {
        throw err;
      }
      throw new Error("Unable to connect to Agent Observatory service.");
    }
  },

  async getMessages(
    token: string | null,
    sessionId: string,
  ): Promise<Message[]> {
    if (!token || !sessionId) {
      return [];
    }

    try {
      const res = await fetch(`${AGENT_URL}/sessions/${sessionId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
        return [];
      }

      const data = await res.json();
      return data.data || [];
    } catch {
      // Backend is starting up, unreachable, or offline
      return [];
    }
  },

  async deleteMessage(
    token: string | null,
    sessionId: string,
    messageId: string,
  ): Promise<void> {
    if (!token || !sessionId || !messageId) return;

    try {
      await fetch(`${AGENT_URL}/sessions/${sessionId}/messages/${messageId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Best-effort optimistic deletion
    }
  },
};
