import { useState } from "react";

interface LoginPanelProps {
  onLogin: (username: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function LoginPanel({ onLogin, loading, error }: LoginPanelProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) onLogin(username, password);
  };

  return (
    <div className="ai-login-panel">
      <p className="ai-login-label">
        Sign in to access the AI Systems Lab Dashboard
      </p>
      <form onSubmit={handleSubmit} className="ai-login-form" noValidate>
        <input
          type="text"
          className="ai-login-input"
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          className="ai-login-input"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="sendBtn"
          disabled={loading || !username || !password}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      {error && (
        <p
          role="alert"
          className="ai-login-error"
          style={{ width: "100%", marginTop: 8 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
