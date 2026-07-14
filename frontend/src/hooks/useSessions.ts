"use client";

import { useCallback, useEffect, useState } from "react";
import { sessionService } from "@/services/session.service";
import type { Session } from "@/types";

export function useSessions(token?: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await sessionService.getSessions(token);
      setSessions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch sessions");
      console.error("Failed to fetch sessions", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(
    async (id: string, name: string) => {
      if (!token) throw new Error("Not authenticated");
      await sessionService.createSession(token, id, name);
      await fetchSessions();
    },
    [token, fetchSessions],
  );

  const renameSession = useCallback(
    async (id: string, name: string) => {
      if (!token || !name.trim()) return;
      await sessionService.renameSession(token, id, name);
      await fetchSessions();
    },
    [token, fetchSessions],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!token) return;
      await sessionService.deleteSession(token, id);
      await fetchSessions();
    },
    [token, fetchSessions],
  );

  return {
    sessions,
    loading,
    error,
    createSession,
    renameSession,
    deleteSession,
    refresh: fetchSessions,
  };
}
