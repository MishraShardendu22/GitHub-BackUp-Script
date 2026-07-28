const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

export interface OpenRouterModel {
  id: string;
  name: string;
}

export const aiService = {
  async fetchModels(): Promise<OpenRouterModel[]> {
    const res = await fetch(`${AGENT_URL}/api/models`);
    if (!res.ok) {
      throw new Error(`Failed to fetch models: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data || [];
  },

  async chat(
    token: string,
    question: string,
    sessionId: string,
    model?: string,
  ) {
    const res = await fetch(`${AGENT_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question: question.trim(),
        session_id: sessionId,
        ...(model && { model }),
      }),
    });

    if (!res.ok || !res.body) {
      if (res.status === 401) {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
      throw new Error(`Agent error: ${res.statusText}`);
    }

    return res.body.getReader();
  },

  async confirmAction(token: string, confirmId: string, approve: boolean) {
    const res = await fetch(`${AGENT_URL}/chat/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirm_id: confirmId, approve }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
      throw new Error("Failed to confirm action");
    }
  },
};
