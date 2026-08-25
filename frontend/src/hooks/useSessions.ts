"use client";

import { useCallback, useEffect, useState } from "react";
import { sessionService } from "@/services/session.service";
import type { Session } from "@/types";

export function useSessions(token?: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null,
  );

  const fetchSessions = useCallback(async () => {
    if (!token) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await sessionService.list(token);
      setSessions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch sessions");
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
      await sessionService.create(token, id, name);
      await fetchSessions();
    },
    [token, fetchSessions],
  );

  const renameSession = useCallback(
    async (id: string, name: string) => {
      if (!token || !name.trim()) return;
      await sessionService.rename(token, id, name);
      await fetchSessions();
    },
    [token, fetchSessions],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!token) return;
      setDeletingSessionId(id);
      // Optimistically remove session from local state immediately
      setSessions((prev) => prev.filter((s) => s.id !== id));
      try {
        await sessionService.delete(token, id);
      } catch (e) {
        // Rollback state from server on failure
        await fetchSessions();
        throw e;
      } finally {
        setDeletingSessionId((prev) => (prev === id ? null : prev));
      }
    },
    [token, fetchSessions],
  );

  return {
    sessions,
    loading,
    error,
    deletingSessionId,
    createSession,
    renameSession,
    deleteSession,
    refresh: fetchSessions,
  };
}
