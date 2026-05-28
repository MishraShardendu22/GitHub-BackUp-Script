"use client";

import { useEffect, useRef, useState } from "react";
import type { WsMessage } from "@/lib/types";

function buildLiveSocketUrl() {
  const configuredBase = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  const baseUrl = new URL(configuredBase);
  const secureProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${secureProtocol}//${baseUrl.host}/ws/live`;
}

export default function LivePage() {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<WsMessage[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(buildLiveSocketUrl());
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.type === "log") {
            setLogs((prev) => [...prev.slice(-500), msg]);
          }
        } catch { /* ignore */ }
      };
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const levelColor = (level?: string) => {
    switch (level) {
      case "error": return "var(--danger)";
      case "warn": return "var(--warning)";
      case "info": return "#1565c0";
      default: return "var(--text-muted)";
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>
            REAL-TIME
          </div>
          <h1 style={{ fontSize: 42, fontFamily: "var(--font-serif)", marginBottom: 8 }}>
            Live logs
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 720 }}>
            A clean stream of worker events from PostgreSQL-backed execution logs.
          </p>
        </div>
        <div className="pill" style={{ gap: 8, fontSize: 13, padding: "8px 14px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "var(--success)" : "var(--danger)" }} />
          {connected ? "Connected" : "Disconnected"}
        </div>
      </div>

      <div className="card" style={{ padding: 0, minHeight: 640 }}>
        <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Log stream</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{logs.length} entries</span>
        </div>
        <div style={{ height: 580, overflow: "auto", padding: "16px 24px", fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12, lineHeight: 1.8 }}>
          {logs.length === 0 ? (
            <div style={{ color: "var(--text-muted)", textAlign: "center", paddingTop: 120, fontSize: 13 }}>
              {connected ? "Waiting for log messages..." : "Connecting to WebSocket..."}
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={`${log.id}-${i}`} style={{ display: "grid", gridTemplateColumns: "88px 42px minmax(140px, 240px) 1fr", gap: 12, alignItems: "start", padding: "6px 0" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                </span>
                <span style={{ color: levelColor(log.level), fontWeight: 700, fontSize: 11 }}>
                  {log.level?.toUpperCase()}
                </span>
                <span style={{ color: "#6b4c9a", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {log.repository ? `[${log.repository}]` : "[system]"}
                </span>
                <span style={{ fontSize: 12, color: "var(--text)" }}>{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
