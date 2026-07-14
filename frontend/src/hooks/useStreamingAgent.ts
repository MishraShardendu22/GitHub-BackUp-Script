import { useState } from "react";
import type { Message, MessageToolCall } from "@/types";

interface StreamEvent {
  type: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  duration_ms?: number;
  success?: boolean;
  content?: string;
  answer?: string;
  confirm_id?: string;
  message?: string;
  iteration?: number;
}

export function useStreamingAgent({
  onLogout,
  onStatsRefresh,
}: {
  onLogout?: () => void;
  onStatsRefresh?: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [activeStep, setActiveStep] = useState<string>("idle");
  const [activeConfirmation, setActiveConfirmation] = useState<{
    confirmId: string;
    name: string;
    args: Record<string, unknown>;
  } | null>(null);

  const sendMessage = async (
    token: string,
    question: string,
    sessionId: string,
    onMessageUpdate: (
      id: string,
      updates: Partial<Message> | ((prev: Message) => Partial<Message>),
    ) => void,
    onMessageAdd: (msg: Message) => void,
  ) => {
    setSending(true);
    setActiveStep("query");
    setActiveConfirmation(null);

    const userMsgId = crypto.randomUUID();
    onMessageAdd({
      id: userMsgId,
      role: "user",
      content: question,
      timestamp: new Date(),
    });

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      streaming: true,
      toolCalls: [] as MessageToolCall[],
    };
    onMessageAdd(assistantMsg);
    setActiveStep("agent");

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/agent/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, session_id: sessionId }),
      });

      if (!response.ok) {
        if (response.status === 401) onLogout?.();
        throw new Error(await response.text());
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let buffer = "";

      const processLine = (line: string) => {
        if (!line.trim() || !line.startsWith("data: ")) return;
        const dataStr = line.slice(6);
        if (dataStr === "[DONE]") return;

        try {
          const event = JSON.parse(dataStr) as StreamEvent;

          onMessageUpdate(assistantMsg.id, (prev: Message) => {
            const toolCalls = prev.toolCalls || [];

            if (event.type === "agent_start") {
              setActiveStep("agent");
              return { iteration: event.iteration || 0 };
            }

            if (event.type === "tool_start") {
              setActiveStep("tools");
              return {
                toolCalls: [
                  ...toolCalls,
                  {
                    name: event.name || "unknown",
                    args: event.args || {},
                    success: false,
                    running: true,
                    duration_ms: null,
                  },
                ],
              };
            }

            if (event.type === "confirm_required") {
              setActiveConfirmation({
                confirmId: event.confirm_id || "",
                name: event.name || "unknown",
                args: event.args || {},
              });
              return {}; // no UI update yet
            }

            if (event.type === "tool_end") {
              return {
                toolCalls: toolCalls.map((t: MessageToolCall) =>
                  t.name === event.name && t.running
                    ? {
                        ...t,
                        success: !!event.success,
                        running: false,
                        duration_ms: event.duration_ms || 0,
                        result: event.result,
                        error: event.error,
                      }
                    : t,
                ),
              };
            }

            if (event.type === "chunk") {
              setActiveStep("response");
              return {
                content: prev.content + (event.content || ""),
              };
            }

            if (event.type === "answer") {
              setActiveStep("idle");
              return {
                content: event.answer || "",
                streaming: false,
              };
            }

            if (event.type === "error") {
              setActiveStep("idle");
              return {
                content: `${prev.content}\n\n**Error:** ${event.error}`,
                streaming: false,
              };
            }

            return prev; // No-op
          });
        } catch (e) {
          console.error("Failed to parse stream event:", e, dataStr);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          processLine(line);
        }
      }

      if (buffer) {
        processLine(buffer);
      }
    } catch (error) {
      console.error("Streaming chat failed", error);
      onMessageUpdate(assistantMsg.id, (prev: Message) => ({
        content: `${prev.content}\n\n*(Error: Connection to agent interrupted)*`,
        streaming: false,
      }));
    } finally {
      setSending(false);
      setActiveStep("idle");
      onStatsRefresh?.();
    }
  };

  const confirmAction = async (token: string, confirmed: boolean) => {
    if (!activeConfirmation) return;
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/agent/confirm/${activeConfirmation.confirmId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmed }),
      });
    } catch (e) {
      console.error("Failed to confirm action", e);
    } finally {
      setActiveConfirmation(null);
    }
  };

  return {
    sending,
    activeStep,
    activeConfirmation,
    sendMessage,
    confirmAction,
  };
}
