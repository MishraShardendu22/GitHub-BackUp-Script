"use client";

import { useState, useRef, useEffect } from "react";
import type { Conversation, ChatMessage } from "@/lib/types";

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
  const [activeConv, setActiveConv] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/api/ai/conversations`).then((r) => r.json()).then(setConversations).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeConv) {
      fetch(`${API}/api/ai/conversations/${activeConv}`).then((r) => r.json()).then(setMessages).catch(() => {});
    } else {
      setMessages([]);
    }
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, {
      id: Date.now(), conversation_id: activeConv ?? 0, role: "user",
      content: msg, tokens_used: 0, web_search: webSearch, created_at: new Date().toISOString(),
    }]);

    try {
      const res = await fetch(`${API}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, conversation_id: activeConv ?? 0, web_search: webSearch }),
      });
      const data = await res.json();

      if (!activeConv && data.conversation_id) {
        setActiveConv(data.conversation_id);
        const convRes = await fetch(`${API}/api/ai/conversations`);
        setConversations(await convRes.json());
      }

      setMessages((prev) => [...prev, {
        id: Date.now() + 1, conversation_id: data.conversation_id, role: "assistant",
        content: data.message, tokens_used: data.tokens_used, web_search: data.web_search,
        created_at: new Date().toISOString(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1, conversation_id: activeConv ?? 0, role: "assistant",
        content: "Error: Could not reach the AI service. Make sure the backend is running.",
        tokens_used: 0, web_search: false, created_at: new Date().toISOString(),
      }]);
    }
    setLoading(false);
  }

  async function sendReport() {
    try {
      await fetch(`${API}/api/reports/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: "latest" }),
      });
      alert("Report email sent!");
    } catch {
      alert("Failed to send report");
    }
  }

  return (
    <div>
      {/* AI Section */}
      <div className="card" style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 6 }}>
              AI ASSISTANT
            </div>
            <h2 style={{ fontSize: 24, fontFamily: "var(--font-serif)", marginBottom: 4 }}>
              Ask the bot
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 460 }}>
              Start with a preset question or write your own. The AI has context from your backup database including metrics, failures, and repository data.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline" onClick={sendReport}>Generate Report</button>
            <button className="btn btn-danger" onClick={sendReport}>Send Email</button>
          </div>
        </div>

        {/* Starter Questions */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 10 }}>
            Starter Questions
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {starterQuestions.map((q) => (
              <button key={q} className="pill" onClick={() => sendMessage(q)}>{q}</button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div style={{ marginBottom: 12 }}>
          <textarea
            className="textarea"
            placeholder="Ask a question (e.g. 'What caused the latest backup failures?')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            disabled={loading}
            style={{ minHeight: 80 }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} style={{ accentColor: "var(--text)" }} />
            Use web search
          </label>
          <button className="btn btn-primary" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
            {loading ? "Generating..." : "Send"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="card" style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Premade questions are shown first so you can jump straight into the most common backup-review flows.
          </div>
          {messages.map((msg) => (
            <div key={msg.id} style={{ marginBottom: 20, padding: "16px 0", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: msg.role === "user" ? "var(--text)" : "var(--text-muted)", marginBottom: 6 }}>
                {msg.role === "user" ? "You" : "AI Assistant"}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {msg.content}
              </div>
              {msg.tokens_used > 0 && msg.role === "assistant" && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                  {msg.tokens_used} tokens{msg.web_search ? " · web search" : ""}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ padding: "16px 0", fontSize: 13, color: "var(--text-muted)" }}>
              Building the AI brief...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Repository Health Section */}
      <RepositoryHealth />
    </div>
  );
}

function RepositoryHealth() {
  const [stats, setStats] = useState<{ total_runs: number; total_repos: number; total_failed: number } | null>(null);

  useEffect(() => {
    fetch(`${API}/api/dashboard/stats`).then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div className="section-title">Repository health</div>
          <div className="section-desc" style={{ marginBottom: 0 }}>Minimal telemetry only, so the AI surface stays focused.</div>
        </div>
        <button className="btn btn-outline">Summary</button>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
        Tracking {stats?.total_repos ?? 0} repositories across {stats?.total_runs ?? 0} backup runs. Failures: {stats?.total_failed ?? 0}.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Repos Tracked</div>
          <div className="stat-value">{stats?.total_repos ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Runs</div>
          <div className="stat-value">{stats?.total_runs ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success</div>
          <div className="stat-value">{(stats?.total_repos ?? 0) - (stats?.total_failed ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failures</div>
          <div className="stat-value">{stats?.total_failed ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
