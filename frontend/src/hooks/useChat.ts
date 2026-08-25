"use client";

import { useCallback, useEffect, useState } from "react";
import { sessionService } from "@/services/session.service";
import type { Message } from "@/types";

export function useChat(token: string | null, sessionId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await sessionService.getMessages(token, sessionId);
      const formatted = data.map((msg) => ({
        id: String(msg.id),
        role: (msg.role as "user" | "assistant") || "assistant",
        content: String(msg.content ?? ""),
        timestamp: new Date(msg.created_at || Date.now()),
        toolCalls: (msg.tool_calls as Message["toolCalls"]) || [],
      }));
      setMessages((prev) => {
        const formattedIds = new Set(formatted.map((m) => m.id));
        const optimistic = prev.filter((m) => !formattedIds.has(m.id));
        return [...formatted, ...optimistic];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
      console.error("Failed to load messages", e);
    } finally {
      setLoading(false);
    }
  }, [token, sessionId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMessage = useCallback(
    (id: string, updates: Partial<Message> | ((prev: Message) => Message)) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          return typeof updates === "function"
            ? updates(m)
            : { ...m, ...updates };
        }),
      );
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const deleteMessage = useCallback(
    async (id: string) => {
      // Optimistically remove message from state immediately
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (token && sessionId) {
        try {
          await sessionService.deleteMessage(token, sessionId, id);
        } catch (e) {
          console.warn("Failed to delete message from server:", e);
        }
      }
    },
    [token, sessionId],
  );

  return {
    messages,
    loading,
    error,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
    refresh: loadMessages,
  };
}
