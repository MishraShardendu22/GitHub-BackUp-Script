import { AGENT_URL } from "@/config/env";

interface LoginResponse {
  access_token: string;
}

export const authService = {
  async login(username: string, password: string): Promise<string> {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);

    const res = await fetch(`${AGENT_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Invalid credentials");
    }

    const data: LoginResponse = await res.json();
    return data.access_token;
  },

  saveSession(token: string, username: string): void {
    localStorage.setItem("agent_token", token);
    localStorage.setItem("agent_username", username);
  },

  clearSession(): void {
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_username");
  },

  getStoredSession(): { token: string | null; username: string | null } {
    return {
      token: localStorage.getItem("agent_token"),
      username: localStorage.getItem("agent_username"),
    };
  },

  async validateToken(token: string): Promise<boolean> {
    try {
      const res = await fetch(`${AGENT_URL}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
