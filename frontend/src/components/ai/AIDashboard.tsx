"use client";

import { ArrowRight } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LoginPanel,
  MessageBubble,
  ModelSelector,
  WorkflowDiagram,
} from "@/components/ai";
import { useAIContext } from "@/components/layout/AIContext";
import { LoaderPanel, MetricCard, ToolBadge } from "@/components/ui";
import { LOADING_MESSAGES, PREMADE_PROMPTS } from "@/constants";
import { useChat } from "@/hooks/useChat";
import { useModels } from "@/hooks/useModels";
import { useStats } from "@/hooks/useStats";
import { useStreamingAgent } from "@/hooks/useStreamingAgent";

const LockIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative lock icon
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export function AIDashboard() {
  const {
    auth,
    isAuthenticated,
    authLoading,
    authError,
    login,
    sessionsLoading,
    sessionsError,
    createSession,
    logout,
  } = useAIContext();

  const params = useParams();

  // Local state for seamless navigation after creating a session
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);

  // Clear local override when URL params change (e.g. Back/Forward navigation)
  useEffect(() => {
    setLocalSessionId(null);
  }, []);

  const activeSessionId =
    localSessionId || (params?.id as string | undefined) || null;
  const currentView = activeSessionId ? "chat" : "dashboard";

  const {
    stats,
    loading: statsLoading,
    refresh: refreshStats,
  } = useStats(auth.token);

  const [input, setInput] = useState("");
  const [loadMsg, setLoadMsg] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);

  const {
    messages,
    loading: messagesLoading,
    addMessage,
    updateMessage,
  } = useChat(auth.token, activeSessionId);
  const {
    sending,
    activeStep,
    activeConfirmation,
    sendMessage: sendStreamMessage,
    confirmAction,
  } = useStreamingAgent({
    onLogout: logout,
    onStatsRefresh: refreshStats,
  });

  const {
    models,
    selectedModel,
    setSelectedModel,
    loading: modelsLoading,
    error: modelsError,
    refresh: refreshModels,
  } = useModels();

  const feedRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("ai-page-active");
    document.body.classList.add("ai-page-active");
    return () => {
      document.documentElement.classList.remove("ai-page-active");
      document.body.classList.remove("ai-page-active");
    };
  }, []);

  useEffect(() => {
    if (statsLoading || sessionsLoading || messagesLoading) {
      setLoadMsg(
        LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)],
      );
    }
  }, [statsLoading, sessionsLoading, messagesLoading]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (
      sessionsError &&
      (sessionsError.includes("401") ||
        sessionsError.includes("Unauthorized") ||
        sessionsError.includes("credentials"))
    ) {
      logout();
    }
  }, [sessionsError, logout]);

  const handleSendMessage = async (question: string) => {
    if (!auth.token || !question.trim() || sending) return;

    let sessionId = activeSessionId;
    try {
      if (!sessionId) {
        const newSessionId = crypto.randomUUID();
        await createSession(
          newSessionId,
          question.trim().slice(0, 30) +
            (question.trim().length > 30 ? "..." : ""),
        );
        sessionId = newSessionId;
        // Soft navigate to preserve chat component state for streaming
        window.history.replaceState(null, "", `/ai/${newSessionId}`);
        setLocalSessionId(newSessionId);
      }

      setHasInteracted(true);
      await sendStreamMessage(
        auth.token,
        question,
        sessionId,
        updateMessage,
        addMessage,
        selectedModel,
      );
      setInput("");
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("Failed to send message:", error);
      const msg = error.message;
      if (
        msg &&
        (msg.includes("401") ||
          msg.includes("Unauthorized") ||
          msg.includes("credentials"))
      ) {
        logout();
      } else {
        alert(msg || "An error occurred while communicating with the agent.");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  return (
    <div className="ai-dashboard-container">
      {/* Main Area */}
      <main className="ai-main-area">
        <header className="ai-agent-header">
          <div className="ai-agent-identity">
            <div className="ai-agent-info">
              <div className="ai-agent-name">Systems Lab Agent</div>
              <div className="ai-agent-status">
                <span className={`ai-status-dot ${sending ? "busy" : ""}`} />
                <span>
                  {sending
                    ? "Processing Query..."
                    : "Online · Ready to analyze telemetry"}
                </span>
              </div>
            </div>
          </div>

          {sending && (
            <div style={{ flex: "1 1 auto", minWidth: 200, maxWidth: 500 }}>
              <WorkflowDiagram activeStep={activeStep} />
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              loading={modelsLoading}
              error={modelsError}
              onRefresh={refreshModels}
              disabled={sending}
            />
            {isAuthenticated && (
              <button
                type="button"
                className="ai-new-chat-btn"
                style={{
                  width: "auto",
                  padding: "6px 16px",
                  fontSize: "13px",
                  background: "rgba(139, 92, 246, 0.12)",
                  borderColor: "var(--accent)",
                  color: "var(--accent)",
                  marginTop: 0,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
                onClick={() =>
                  handleSendMessage(
                    "Generate a full backup health report and email it to me.",
                  )
                }
                disabled={sending}
              >
                Generate & Email Report
              </button>
            )}
            <div
              className="ai-tools-list"
              style={{ marginTop: 0, flexShrink: 0 }}
            >
              <ToolBadge name="Metrics" />
              <ToolBadge name="Backup Runs" />
              <ToolBadge name="Logs" />
              <ToolBadge name="Analytics" />
            </div>
          </div>
        </header>

        <div
          className="ai-content-scroll-area"
          ref={currentView === "chat" ? feedRef : undefined}
        >
          {currentView === "dashboard" ? (
            statsLoading && !stats ? (
              <LoaderPanel message={loadMsg} />
            ) : (
              <div className="ai-dashboard-panel">
                <div style={{ marginBottom: "28px" }}>
                  <div className="page-kicker">Systems Lab Operations</div>
                  <h1 className="hero-title" style={{ margin: "4px 0" }}>
                    Systems Lab Dashboard
                  </h1>
                  <p
                    className="hero-subtitle"
                    style={{ fontSize: "16px", color: "var(--text-secondary)" }}
                  >
                    Real-time analysis statistics from agent database
                    executions, success parameters, and tool call distribution
                    metrics.
                  </p>
                </div>

                <div className="ai-dashboard-grid">
                  <MetricCard
                    label="Total Conversations"
                    value={stats?.total_conversations ?? 0}
                  />
                  <MetricCard
                    label="Agent Executions"
                    value={stats?.total_agent_runs ?? 0}
                  />
                  <MetricCard
                    label="Model Success Rate"
                    value={
                      stats ? `${stats.success_rate.toFixed(1)}%` : "100.0%"
                    }
                  />
                  <MetricCard
                    label="Database Memory"
                    value={`${stats?.memory_stats.total_messages ?? 0} msgs`}
                  />
                </div>

                <div className="ai-dashboard-section-title">
                  Telemetry Tool Call Statistics
                </div>
                <div
                  className="ai-rich-table-container"
                  style={{ marginBottom: 32 }}
                >
                  <table className="ai-rich-table">
                    <thead>
                      <tr>
                        <th>Tool Name</th>
                        <th>Invocations</th>
                        <th>Avg Latency</th>
                        <th>Success Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.tool_usage && stats.tool_usage.length > 0 ? (
                        stats.tool_usage.map((tool) => (
                          <tr key={tool.name}>
                            <td
                              data-label="Tool Name"
                              style={{
                                fontFamily: "monospace",
                                color: "var(--accent)",
                                fontSize: "14.5px",
                              }}
                            >
                              {tool.name}
                            </td>
                            <td data-label="Invocations">{tool.count} runs</td>
                            <td data-label="Avg Latency">
                              {tool.avg_duration.toFixed(0)} ms
                            </td>
                            <td data-label="Success Rate">
                              <span
                                className={`badge ${tool.success_rate > 90 ? "badge-success" : "badge-warning"}`}
                              >
                                {tool.success_rate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              textAlign: "center",
                              color: "var(--text-secondary)",
                              padding: 20,
                            }}
                          >
                            No tool call logs recorded in the database yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="ai-dashboard-section-title">
                  Ask the Agent About Backups
                </div>
                {!hasInteracted && (
                  <div className="premadeGrid" style={{ marginTop: 12 }}>
                    {PREMADE_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="premadeBtn"
                        onClick={() => {
                          if (isAuthenticated) {
                            setInput(prompt);
                            composerRef.current?.focus();
                          }
                        }}
                        disabled={sending || !isAuthenticated}
                        style={
                          !isAuthenticated
                            ? {
                                opacity: 0.6,
                                cursor: "not-allowed",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }
                            : {}
                        }
                      >
                        {!isAuthenticated && <LockIcon />}
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="ai-chat-messages">
              {messagesLoading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "200px",
                    color: "var(--text-secondary)",
                    fontSize: "16px",
                  }}
                >
                  <LoaderPanel
                    message={loadMsg || "Retrieving conversation history..."}
                  />
                </div>
              ) : messages.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "200px",
                    color: "var(--text-secondary)",
                    fontSize: "16px",
                  }}
                >
                  No messages in this chat session yet. Ask a question below to
                  start.
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}
            </div>
          )}
        </div>

        <div className="ai-chat-composer-wrap">
          {isAuthenticated ? (
            <form
              onSubmit={handleSubmit}
              className="composerWrap"
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
              }}
            >
              <textarea
                ref={composerRef}
                className="composer"
                style={{
                  flex: 1,
                  minHeight: "38px",
                  height: "38px",
                  maxHeight: "80px",
                  resize: "none",
                  margin: 0,
                  padding: "8px 12px",
                  lineHeight: "20px",
                }}
                placeholder={
                  currentView === "dashboard"
                    ? "Type here to start a new analysis chat..."
                    : "Ask the agent anything about your backups..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(input);
                  }
                }}
                disabled={sending}
                rows={1}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <button
                  type="submit"
                  className="sendBtn"
                  style={{
                    height: "32px",
                    padding: "0 16px",
                    marginTop: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontSize: "14px",
                  }}
                  disabled={sending || !input.trim()}
                >
                  <span>{sending ? "Processing…" : "Execute Reasoning"}</span>
                  {!sending && <ArrowRight size={13} />}
                </button>
                <span
                  className="promptHint"
                  style={{
                    fontSize: "12px",
                    margin: 0,
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {sending
                    ? "Agent reasoning…"
                    : "Enter to send · Shift+Enter new line"}
                </span>
              </div>
            </form>
          ) : (
            <LoginPanel
              onLogin={login}
              loading={authLoading}
              error={authError}
            />
          )}
        </div>
      </main>

      {activeConfirmation && (
        <div className="ai-confirm-overlay">
          <div className="ai-confirm-modal">
            <h3>Confirm Sensitive Action</h3>
            <p>
              The agent wants to execute the tool{" "}
              <code>{activeConfirmation.name}</code> to send an email report:
            </p>
            <div className="ai-confirm-details">
              <div>
                <strong>Subject:</strong>{" "}
                {String(activeConfirmation.args?.subject || "")}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Recipients:</strong>{" "}
                {Array.isArray(activeConfirmation.args?.recipients)
                  ? activeConfirmation.args.recipients.join(", ")
                  : "Default Recipient (SMTP_TO)"}
              </div>
            </div>
            <div className="ai-confirm-actions">
              <button
                type="button"
                className="ai-confirm-btn"
                onClick={() => confirmAction(auth.token || "", true)}
              >
                Yes, Send Email
              </button>
              <button
                type="button"
                className="ai-confirm-btn-abort"
                onClick={() => confirmAction(auth.token || "", false)}
              >
                No, Abort
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
