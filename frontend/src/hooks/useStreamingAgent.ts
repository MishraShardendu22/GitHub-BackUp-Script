"use client";

import { useCallback, useState } from "react";
import { uid } from "@/lib/utils";
import { aiService } from "@/services/ai.service";
import type { ConfirmationRequest, Message, StreamEvent } from "@/types";

interface UseStreamingAgentOptions {
  onLogout: () => void;
  onStatsRefresh?: () => void;
}

export function useStreamingAgent({
  onLogout,
  onStatsRefresh,
}: UseStreamingAgentOptions) {
  const [sending, setSending] = useState(false);
  const [activeStep, setActiveStep] = useState<string>("idle");
  const [activeConfirmation, setActiveConfirmation] =
    useState<ConfirmationRequest | null>(null);

  const sendMessage = useCallback(
    async (
      token: string,
      question: string,
      sessionId: string,
      onMessageUpdate: (
        id: string,
        updates: Partial<Message> | ((prev: Message) => Message),
      ) => void,
      onMessageAdd: (message: Message) => void,
      model?: string,
    ) => {
      if (sending) return;

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: question.trim(),
        timestamp: new Date(),
      };

      const assistantMsg: Message = {
        id: uid(),
        role: "assistant",
        content: "",
        streaming: true,
        timestamp: new Date(),
        toolCalls: [],
      };

      onMessageAdd(userMsg);
      onMessageAdd(assistantMsg);

      setSending(true);
      setActiveStep("query");

      try {
        const reader = await aiService.chat(token, question, sessionId, model);
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;

              try {
                const event: StreamEvent = JSON.parse(dataStr);

                if (event.type === "info" || event.type === "agent_reasoning") {
                  setActiveStep("agent");
                  if (event.type === "info" && event.sources) {
                    onMessageUpdate(assistantMsg.id, {
                      sources: event.sources,
                    });
                  }
                  if (event.type === "agent_reasoning") {
                    onMessageUpdate(assistantMsg.id, {
                      iteration: event.iteration,
                    });
                  }
                } else if (event.type === "confirm_required") {
                  setActiveConfirmation({
                    confirmId: event.confirm_id ?? "",
                    name: event.name ?? "",
                    args: event.args || {},
                  });
                } else if (event.type === "tool_start") {
                  setActiveStep("tools");
                  onMessageUpdate(assistantMsg.id, (prev: Message) => {
                    const toolCalls = prev.toolCalls || [];
                    if (toolCalls.some((t) => t.name === event.name))
                      return prev;
                    return {
                      ...prev,
                      toolCalls: [
                        ...toolCalls,
                        {
                          name: event.name ?? "tool",
                          args: event.args || {},
                          success: false,
                          running: true,
                          duration_ms: null,
                        },
                      ],
                    };
                  });
                } else if (event.type === "tool_end") {
                  onMessageUpdate(assistantMsg.id, (prev: Message) => {
                    const toolCalls = prev.toolCalls || [];
                    return {
                      ...prev,
                      toolCalls: toolCalls.map((t) =>
                        t.name === event.name
                          ? {
                              ...t,
                              success: Boolean(event.success),
                              running: false,
                              duration_ms: event.duration_ms ?? 0,
                              result: event.result,
                              error: event.error,
                            }
                          : t,
                      ),
                    };
                  });
                } else if (event.type === "token") {
                  setActiveStep("response");
                  onMessageUpdate(assistantMsg.id, (prev: Message) => ({
                    ...prev,
                    content: prev.content + event.text,
                  }));
                } else if (event.type === "done") {
                  setActiveStep("idle");
                  onMessageUpdate(assistantMsg.id, {
                    content: event.answer ?? "",
                    streaming: false,
                  });
                }
              } catch (_err) {
                onMessageUpdate(assistantMsg.id, (prev: Message) => ({
                  ...prev,
                  content: prev.content + dataStr,
                }));
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("401")) {
          onLogout();
        }
        const msg = err instanceof Error ? err.message : "Something went wrong";
        onMessageUpdate(assistantMsg.id, {
          content: `⚠ ${msg}`,
          streaming: false,
        });
      } finally {
        setSending(false);
        setActiveStep("idle");
        onStatsRefresh?.();
      }
    },
    [sending, onLogout, onStatsRefresh],
  );

  const confirmAction = useCallback(
    async (token: string, approve: boolean) => {
      if (!activeConfirmation) return;
      const confirmId = activeConfirmation.confirmId;
      setActiveConfirmation(null);
      try {
        await aiService.confirmAction(token, confirmId, approve);
      } catch (e) {
        console.error("Failed to confirm action", e);
      }
    },
    [activeConfirmation],
  );

  return {
    sending,
    activeStep,
    activeConfirmation,
    sendMessage,
    confirmAction,
  };
}
