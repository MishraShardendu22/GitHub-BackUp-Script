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
    <div className="m-stack">
      <p className="m-label">Sign in to access the AI Systems Lab Dashboard</p>
      <form onSubmit={handleSubmit} className="m-cluster" noValidate>
        <input
          type="text"
          className="m-input"
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          className="m-input"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="m-btn m-btn--primary"
          disabled={loading || !username || !password}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      {error && (
        <p
          role="alert"
          className="m-alert m-alert--critical"
          style={{ width: "100%", marginTop: 8 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
