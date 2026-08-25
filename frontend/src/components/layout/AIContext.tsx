"use client";

import type React from "react";
import { createContext, useCallback, useContext, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSessions } from "@/hooks/useSessions";
import type { AuthState, Session } from "@/types";

interface AIContextType {
  auth: AuthState;
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;

  sessions: Session[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  deletingSessionId: string | null;
  createSession: (id: string, name: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIContextProvider({ children }: { children: React.ReactNode }) {
  const authData = useAuth();
  const {
    auth,
    isAuthenticated,
    loading: authLoading,
    error: authError,
    login,
    logout,
  } = authData;

  const {
    sessions,
    loading: sessionsLoading,
    error: sessionsError,
    deletingSessionId,
    createSession,
    renameSession,
    deleteSession,
  } = useSessions(auth.token);

  // Reset chat view states on logout
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  useEffect(() => {
    const handleUnauthorized = () => {
      handleLogout();
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [handleLogout]);

  return (
    <AIContext.Provider
      value={{
        auth,
        isAuthenticated,
        authLoading,
        authError,
        login,
        logout: handleLogout,
        sessions,
        sessionsLoading,
        sessionsError,
        deletingSessionId,
        createSession,
        renameSession,
        deleteSession,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAIContext must be used within an AIContextProvider");
  }
  return context;
}
