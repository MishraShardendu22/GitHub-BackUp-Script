"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, Globe, Trash2, Plus, Loader2 } from "lucide-react";
import type { Conversation, ChatMessage } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    fetch(`${API}/api/ai/conversations`)
      .then((r) => r.json())
      .then(setConversations)
      .catch(() => {});
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConv) {
      fetch(`${API}/api/ai/conversations/${activeConv}`)
        .then((r) => r.json())
        .then(setMessages)
        .catch(() => {});
    } else {
      setMessages([]);
    }
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // Optimistic user message
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        conversation_id: activeConv ?? 0,
        role: "user",
        content: userMessage,
        tokens_used: 0,
        web_search: webSearch,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch(`${API}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: activeConv ?? 0,
          web_search: webSearch,
        }),
      });

      const data = await res.json();

      if (!activeConv && data.conversation_id) {
        setActiveConv(data.conversation_id);
        // Refresh conversation list
        const convRes = await fetch(`${API}/api/ai/conversations`);
        setConversations(await convRes.json());
      }

      setMessages((prev) => [
        ...prev,
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
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          conversation_id: activeConv ?? 0,
          role: "assistant",
          content: "Error: Failed to get response. Check if the backend is running.",
          tokens_used: 0,
          web_search: false,
          created_at: new Date().toISOString(),
        },
      ]);
    }

    setLoading(false);
  }

  async function deleteConv(id: number) {
    await fetch(`${API}/api/ai/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConv === id) {
      setActiveConv(null);
      setMessages([]);
    }
  }

  return (
    <div style={{ display: "flex", gap: 24, height: "calc(100vh - 48px)" }}>
      {/* Sidebar - Conversations */}
      <div
        style={{
          width: 260,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>Conversations</span>
          <button
            onClick={() => {
              setActiveConv(null);
              setMessages([]);
            }}
            className="btn btn-outline"
            style={{ padding: "4px 8px" }}
          >
            <Plus size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveConv(conv.id)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                cursor: "pointer",
                marginBottom: 2,
                background:
                  activeConv === conv.id
                    ? "rgba(99, 102, 241, 0.08)"
                    : "transparent",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {conv.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConv(conv.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  padding: 2,
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Bot size={20} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 600 }}>AI Assistant</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Ask about backups, failures, metrics, and more
          </span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                paddingTop: 80,
                color: "var(--text-secondary)",
              }}
            >
              <Bot size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
              <p style={{ fontSize: 16, marginBottom: 8 }}>
                Ask me anything about your backups
              </p>
              <p style={{ fontSize: 13 }}>
                I can analyze failures, explain trends, and help debug issues
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: 16,
                display: "flex",
                justifyContent:
                  msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "70%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  fontSize: 14,
                  lineHeight: 1.6,
                  background:
                    msg.role === "user"
                      ? "var(--accent)"
                      : "var(--bg-secondary)",
                  color: msg.role === "user" ? "white" : "var(--text-primary)",
                  borderBottomRightRadius: msg.role === "user" ? 4 : 12,
                  borderBottomLeftRadius: msg.role === "assistant" ? 4 : 12,
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
                {msg.tokens_used > 0 && msg.role === "assistant" && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-secondary)",
                      marginTop: 8,
                    }}
                  >
                    {msg.tokens_used} tokens
                    {msg.web_search && " • 🌐 web search"}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)" }}>
              <Loader2 size={16} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            onClick={() => setWebSearch(!webSearch)}
            className={webSearch ? "btn btn-primary" : "btn btn-outline"}
            style={{ padding: "8px 10px" }}
            title={webSearch ? "Web search enabled" : "Web search disabled"}
          >
            <Globe size={16} />
          </button>
          <input
            className="input"
            placeholder="Ask about your backups..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            className="btn btn-primary"
            style={{ padding: "8px 12px" }}
            disabled={loading || !input.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
