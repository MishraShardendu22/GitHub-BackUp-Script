"use client";

import { useEffect, useRef, useState } from "react";
import type { WsMessage } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

function buildLiveSocketUrl() {
  const configuredBase = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  const baseUrl = new URL(configuredBase);
  const secureProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${secureProtocol}//${baseUrl.host}/ws/live`;
}

export default function LivePage() {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<WsMessage[]>([]);
  const [status, setStatus] = useState<WsMessage | null>(null);
  const [analytics, setAnalytics] = useState<WsMessage | null>(null);
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
          } else if (msg.type === "status") {
            setStatus(msg);
          } else if (msg.type === "analytics") {
            setAnalytics(msg);
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

  const workerRunning = status?.status === "running";
  const progress = status ? ((status.successful ?? 0) + (status.failed ?? 0) + (status.skipped ?? 0)) : 0;
  const total = status?.total_repos ?? 0;
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  const levelColor = (level?: string) => {
    switch (level) {
      case "error": return "var(--danger)";
      case "warn": return "var(--warning)";
      case "info": return "#1565c0";
      default: return "var(--text-muted)";
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>
          REAL-TIME
        </div>
        <h1 style={{ fontSize: 36, fontFamily: "var(--font-serif)", marginBottom: 8 }}>
          Live monitor
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          WebSocket connection to the running worker process.
        </p>
      </div>

      {/* Status cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Connection</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "var(--success)" : "var(--danger)" }} />
            <span style={{ fontWeight: 500 }}>{connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Worker</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: workerRunning ? "#1565c0" : "var(--text-muted)" }} />
            <span style={{ fontWeight: 500 }}>{workerRunning ? "Running" : "Idle"}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Progress</div>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>{progress} / {total} ({pct}%)</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Live counters */}
      {status && workerRunning && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
          <div className="stat-card" style={{ textAlign: "center" }}>
            <div className="stat-value" style={{ color: "var(--success)" }}>{status.successful ?? 0}</div>
            <div className="stat-label" style={{ marginBottom: 0, marginTop: 4 }}>Successful</div>
          </div>
          <div className="stat-card" style={{ textAlign: "center" }}>
            <div className="stat-value" style={{ color: "var(--danger)" }}>{status.failed ?? 0}</div>
            <div className="stat-label" style={{ marginBottom: 0, marginTop: 4 }}>Failed</div>
          </div>
          <div className="stat-card" style={{ textAlign: "center" }}>
            <div className="stat-value">{status.skipped ?? 0}</div>
            <div className="stat-label" style={{ marginBottom: 0, marginTop: 4 }}>Skipped</div>
          </div>
        </div>
      )}

      {analytics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total backup size</div>
            <div className="stat-value">{formatBytes(analytics.total_size_bytes ?? 0)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Largest repository</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {analytics.largest_repository ?? "—"}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
              {formatBytes(analytics.largest_archive_bytes ?? 0)} archived
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tracked repositories</div>
            <div className="stat-value">{analytics.repositories_tracked ?? 0}</div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
              {analytics.sampled_at ? new Date(analytics.sampled_at).toLocaleTimeString() : "Live sample"}
            </div>
          </div>
        </div>
      )}

      {/* Log stream */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Log stream</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{logs.length} entries</span>
        </div>
        <div style={{ height: 420, overflow: "auto", padding: "12px 24px", fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12, lineHeight: 1.8 }}>
          {logs.length === 0 ? (
            <div style={{ color: "var(--text-muted)", textAlign: "center", paddingTop: 80, fontSize: 13 }}>
              {connected ? "Waiting for log messages..." : "Connecting to WebSocket..."}
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={`${log.id}-${i}`} style={{ display: "flex", gap: 10 }}>
                <span style={{ color: "var(--text-muted)", minWidth: 70, fontSize: 11 }}>
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                </span>
                <span style={{ color: levelColor(log.level), fontWeight: 600, minWidth: 42, fontSize: 11 }}>
                  {log.level?.toUpperCase()}
                </span>
                {log.repository && <span style={{ color: "#6b4c9a", fontSize: 11 }}>[{log.repository}]</span>}
                <span style={{ fontSize: 12 }}>{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
