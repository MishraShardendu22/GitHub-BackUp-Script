import { AlertCircle, Lock, User } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="flex flex-col items-center justify-center p-8 bg-card w-full max-w-md mx-auto rounded-xl shadow-lg border">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">
        Agent Authentication
      </h3>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Sign in to access the AI Observatory Dashboard and execute reasoning
        tasks.
      </p>

      <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
            <User className="h-4 w-4" />
          </div>
          <Input
            type="text"
            className="pl-10"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
            <Lock className="h-4 w-4" />
          </div>
          <Input
            type="password"
            className="pl-10"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div
            className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !username || !password}
        >
          {loading ? "Authenticating..." : "Sign In to Dashboard"}
        </Button>
      </form>
    </div>
  );
}
