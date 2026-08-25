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
        requestId: msg.request_id ? String(msg.request_id) : undefined,
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

  const [deletingMessageIds, setDeletingMessageIds] = useState<Set<string>>(
    new Set(),
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const deleteMessage = useCallback(
    async (id: string) => {
      // 1. Identify which message IDs are being deleted (turn-based cascade)
      const toDelete = new Set<string>();
      const targetIndex = messages.findIndex((m) => m.id === id);
      if (targetIndex !== -1) {
        const target = messages[targetIndex];
        if (target.requestId) {
          for (const m of messages) {
            if (m.requestId === target.requestId) toDelete.add(m.id);
          }
        } else if (target.role === "user") {
          toDelete.add(target.id);
          const nextMsg = messages[targetIndex + 1];
          if (nextMsg && nextMsg.role === "assistant") {
            toDelete.add(nextMsg.id);
          }
        } else {
          toDelete.add(target.id);
        }
      } else {
        toDelete.add(id);
      }

      // 2. Mark as deleting to trigger smooth CSS exit animation
      setDeletingMessageIds((prev) => {
        const next = new Set(prev);
        for (const mid of toDelete) next.add(mid);
        return next;
      });

      // 3. Wait for the smooth CSS collapse animation (240ms)
      await new Promise((resolve) => setTimeout(resolve, 240));

      // 4. Remove from messages state
      setMessages((prev) => prev.filter((m) => !toDelete.has(m.id)));
      setDeletingMessageIds((prev) => {
        const next = new Set(prev);
        for (const mid of toDelete) next.delete(mid);
        return next;
      });

      // 5. Synchronize with backend API
      if (token && sessionId) {
        try {
          await sessionService.deleteMessage(token, sessionId, id);
        } catch (e) {
          console.warn("Failed to delete message from server:", e);
        }
      }
    },
    [token, sessionId, messages],
  );

  return {
    messages,
    loading,
    error,
    deletingMessageIds,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
    refresh: loadMessages,
  };
}
