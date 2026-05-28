"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Conversation, DashboardStats } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const starterQuestions = [
  "Which repositories show unusual growth this week?",
  "Summarize the latest backup failures and likely causes.",
  "What retention risks should we address this quarter?",
  "Which repos should we prioritize for cleanup or archival?",
  "What monitoring gaps are most urgent to close?",
];

export default function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/api/ai/conversations`, { cache: "no-store" })
      .then((response) => response.json())
      .then(setConversations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    fetch(`${API}/api/ai/conversations/${activeConversationId}`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then(setMessages)
      .catch(() => {});
  }, [activeConversationId]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function focusComposer() {
    composerRef.current?.focus();
  }

  function draftPrompt(prompt: string) {
    setInput(prompt);
    focusComposer();
  }

  function startNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setReportStatus(null);
    focusComposer();
  }
  async function refreshConversations() {
    const response = await fetch(`${API}/api/ai/conversations`, {
      cache: "no-store",
    });
    if (response.ok) {
      setConversations(await response.json());
    }
  }

  async function sendMessage(text?: string) {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) {
      return;
    }

    setInput("");
    setLoading(true);
    setReportStatus(null);

    setMessages((previous) => [
      ...previous,
      {
        id: Date.now(),
        conversation_id: activeConversationId ?? 0,
        role: "user",
        content: messageText,
        tokens_used: 0,
        web_search: webSearch,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch(`${API}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          conversation_id: activeConversationId ?? 0,
          web_search: webSearch,
        }),
      });
      const data = await response.json();

      if (!activeConversationId && data.conversation_id) {
        setActiveConversationId(data.conversation_id);
        await refreshConversations();
      }

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          conversation_id: data.conversation_id,
          role: "assistant",
          content: data.message,
          tokens_used: data.tokens_used,
          web_search: data.web_search,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          conversation_id: activeConversationId ?? 0,
          role: "assistant",
          content:
            "The AI service is unavailable right now. Check that the backend is running and try again.",
          tokens_used: 0,
          web_search: false,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function sendReport() {
    setReportStatus("Sending latest report...");
    try {
      const response = await fetch(`${API}/api/reports/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: "latest" }),
      });

      if (!response.ok) {
        throw new Error("report request failed");
      }

      setReportStatus("Latest report queued for email delivery.");
    } catch {
      setReportStatus("Could not send the report right now.");
    }
  }

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px minmax(0, 1fr)",
        gap: 24,
        alignItems: "start",
      }}
    >
      <aside
        className="card"
        style={{
          padding: 24,
          position: "sticky",
          top: 24,
          display: "grid",
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            AI ASSISTANT
          </div>
          <h1 style={{ fontSize: 36, lineHeight: 1, marginBottom: 10 }}>
            Backup analyst
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.7,
            }}
          >
            Ask about backup runs, failures, repository growth, and the latest
            snapshot data. Suggestions stay in the composer until you send them.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div className="stat-card" style={{ padding: 16 }}>
            <div className="stat-label">Chats</div>
            <div className="stat-value" style={{ fontSize: 24 }}>
              {conversations.length}
            </div>
          </div>
          <div className="stat-card" style={{ padding: 16 }}>
            <div className="stat-label">Mode</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {webSearch ? "Web + DB" : "DB only"}
            </div>
          </div>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div className="section-title" style={{ marginBottom: 0 }}>
              Quick prompts
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={startNewChat}
            >
              New chat
            </button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {starterQuestions.slice(0, 3).map((question) => (
              <button
                key={question}
                type="button"
                className="pill"
                onClick={() => draftPrompt(question)}
                style={{
                  justifyContent: "flex-start",
                  whiteSpace: "normal",
                  textAlign: "left",
                }}
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-title">Conversation list</div>
          <div className="section-desc">
            Switch between previous sessions or start a fresh thread.
          </div>
          <div
            style={{
              display: "grid",
              gap: 8,
              maxHeight: 340,
              overflow: "auto",
              paddingRight: 4,
            }}
          >
            {conversations.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                No saved conversations yet.
              </div>
            ) : (
              conversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    className="card"
                    style={{
                      textAlign: "left",
                      padding: 14,
                      borderColor: isActive ? "var(--text)" : "var(--border)",
                      background: isActive
                        ? "var(--bg-hover)"
                        : "var(--bg-card)",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}
                    >
                      {conversation.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(conversation.created_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" },
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      <main style={{ display: "grid", gap: 24 }}>
        <section
          className="card"
          style={{
            padding: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 760,
          }}
        >
          <div
            style={{
              padding: 24,
              borderBottom: "1px solid var(--border-light)",
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                AI Workspace
              </div>
              <h2 style={{ fontSize: 30, lineHeight: 1, marginBottom: 8 }}>
                {activeConversation?.title ?? "New conversation"}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  maxWidth: 720,
                }}
              >
                The assistant reads from the backup database and can optionally
                search the web. Questions remain in the composer until you send
                them.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={startNewChat}
              >
                New chat
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={sendReport}
              >
                Send latest report
              </button>
            </div>
          </div>

          {reportStatus ? (
            <div
              style={{
                padding: "14px 24px 0",
                color: "var(--text-secondary)",
                fontSize: 13,
              }}
            >
              {reportStatus}
            </div>
          ) : null}

          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 24,
              display: "grid",
              gap: 16,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.7), rgba(247,245,240,0.85))",
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  minHeight: 420,
                  textAlign: "center",
                }}
              >
                <div style={{ maxWidth: 640 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      marginBottom: 12,
                    }}
                  >
                    Start with a structured prompt or write your own.
                  </div>
                  <h3 style={{ fontSize: 30, marginBottom: 10 }}>
                    Ask for facts, not guesses.
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--text-secondary)",
                      lineHeight: 1.8,
                      marginBottom: 20,
                    }}
                  >
                    The assistant will answer from the persisted backup data,
                    current run metrics, and the latest repository snapshot.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: "center",
                    }}
                  >
                    {starterQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        className="pill"
                        onClick={() => draftPrompt(question)}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <article
                    key={message.id}
                    style={{
                      display: "flex",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "min(780px, 92%)",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: isUser ? "var(--text)" : "var(--text-muted)",
                        }}
                      >
                        {isUser ? "You" : "Assistant"}
                      </div>
                      <div
                        style={{
                          padding: "16px 18px",
                          borderRadius: 18,
                          border: "1px solid var(--border)",
                          background: isUser ? "var(--text)" : "var(--bg-card)",
                          color: isUser ? "#fff" : "var(--text)",
                          boxShadow: isUser
                            ? "0 8px 24px rgba(26, 26, 26, 0.08)"
                            : "none",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.8,
                        }}
                      >
                        {message.content}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {new Date(message.created_at).toLocaleTimeString(
                          "en-US",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                        {message.role === "assistant" && message.tokens_used > 0
                          ? ` · ${message.tokens_used} tokens${message.web_search ? " · web search" : ""}`
                          : ""}
                      </div>
                    </div>
                  </article>
                );
              })
            )}

            {loading ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Thinking through the latest data...
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div
            style={{
              borderTop: "1px solid var(--border-light)",
              padding: 20,
              background: "var(--bg-card)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {starterQuestions.slice(0, 3).map((question) => (
                <button
                  key={question}
                  type="button"
                  className="pill"
                  onClick={() => draftPrompt(question)}
                >
                  {question}
                </button>
              ))}
            </div>

            <textarea
              ref={composerRef}
              className="textarea"
              placeholder="Ask about backup failures, repository growth, or the latest metrics."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              disabled={loading}
              style={{ minHeight: 118, resize: "vertical", marginBottom: 12 }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={webSearch}
                  onChange={(event) => setWebSearch(event.target.checked)}
                  style={{ accentColor: "var(--text)" }}
                />
                Use web search
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
              >
                {loading ? "Generating..." : "Send message"}
              </button>
            </div>
          </div>
        </section>

        <RepositoryHealth />
      </main>
    </div>
  );
}

function RepositoryHealth() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch(`${API}/api/dashboard/stats`, { cache: "no-store" })
      .then((response) => response.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const latestAnalytics = stats?.latest_analytics ?? null;

  return (
    <section className="card" style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <div className="section-title">Repository health</div>
          <div className="section-desc" style={{ marginBottom: 0 }}>
            Facts pulled from the dashboard totals and the latest stored
            snapshot.
          </div>
        </div>
        <div className="pill" style={{ cursor: "default" }}>
          {stats?.last_run_status ?? "No run yet"}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className="stat-card">
          <div className="stat-label">Repositories</div>
          <div className="stat-value">{stats?.total_repos ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Successful backups</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {stats?.total_successful ?? 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failures</div>
          <div className="stat-value" style={{ color: "var(--danger)" }}>
            {stats?.total_failed ?? 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Latest commits</div>
          <div className="stat-value">
            {latestAnalytics?.total_commits ?? 0}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <div className="card-flat">
          <div className="stat-label">Latest blob path</div>
          <div
            className="stat-value"
            style={{
              fontSize: 20,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {latestAnalytics?.largest_blob_path ?? "—"}
          </div>
        </div>
        <div className="card-flat">
          <div className="stat-label">Largest blob size</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {latestAnalytics
              ? `${(latestAnalytics.largest_blob_size_bytes / 1024 / 1024).toFixed(1)} MB`
              : "—"}
          </div>
        </div>
        <div className="card-flat">
          <div className="stat-label">Tracked files</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {latestAnalytics?.tracked_files ?? 0}
          </div>
        </div>
      </div>
    </section>
  );
}
