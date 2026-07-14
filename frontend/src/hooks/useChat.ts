import { useCallback, useEffect, useState } from "react";
import { sessionService } from "@/services/session.service";
import type { Message } from "@/types";

export function useChat(token: string | null, sessionId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!token || !sessionId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const data = await sessionService.getMessages(token, sessionId);
      const formatted = data.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: new Date(msg.created_at),
        toolCalls: msg.tool_calls || [],
        streaming: false,
      }));
      setMessages(formatted);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load messages");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [token, sessionId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateMessage = useCallback(
    (
      id: string,
      updates: Partial<Message> | ((prev: Message) => Partial<Message>),
    ) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          const patch = typeof updates === "function" ? updates(m) : updates;
          return { ...m, ...patch };
        }),
      );
    },
    [],
  );

  return {
    messages,
    loading,
    error,
    addMessage,
    updateMessage,
    refresh: fetchMessages,
  };
}
