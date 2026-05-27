"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, Circle } from "lucide-react";
import type { WsMessage } from "@/lib/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws/live";

export default function LivePage() {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<WsMessage[]>([]);
  const [status, setStatus] = useState<WsMessage | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000); // Reconnect after 3s
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.type === "log") {
            setLogs((prev) => [...prev.slice(-500), msg]); // Keep last 500 logs
          } else if (msg.type === "status") {
            setStatus(msg);
          }
        } catch {
          // ignore
        }
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
      case "error": return "#f87171";
      case "warn": return "#fbbf24";
      case "info": return "#60a5fa";
      case "debug": return "#8888a0";
      default: return "#e4e4ef";
    }
  };

  const workerRunning = status?.status === "running";
  const progress = status
    ? ((status.successful ?? 0) + (status.failed ?? 0) + (status.skipped ?? 0))
    : 0;
  const total = status?.total_repos ?? 0;
  const progressPct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Radio size={28} /> Live Monitoring
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Real-time worker status and log stream
        </p>
      </div>

      {/* Connection + Worker Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
            WebSocket
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Circle
              size={10}
              fill={connected ? "#10b981" : "#ef4444"}
              color={connected ? "#10b981" : "#ef4444"}
            />
            <span style={{ fontWeight: 600 }}>
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
            Worker Status
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Circle
              size={10}
              fill={workerRunning ? "#6366f1" : "#6b7280"}
              color={workerRunning ? "#6366f1" : "#6b7280"}
            />
            <span style={{ fontWeight: 600 }}>
              {workerRunning ? "Running" : "Idle"}
            </span>
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
            Progress
          </div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {progress} / {total} repos ({progressPct}%)
          </div>
          <div
            style={{
              height: 6,
              background: "var(--border)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                borderRadius: 3,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      {status && workerRunning && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>
              {status.successful ?? 0}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Successful</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>
              {status.failed ?? 0}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Failed</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-secondary)" }}>
              {status.skipped ?? 0}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Skipped</div>
          </div>
        </div>
      )}

      {/* Live Log Stream */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>Log Stream</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {logs.length} entries
          </span>
        </div>
        <div
          style={{
            height: 400,
            overflow: "auto",
            padding: "8px 16px",
            fontFamily: "var(--font-geist-mono)",
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          {logs.length === 0 ? (
            <div
              style={{
                color: "var(--text-secondary)",
                textAlign: "center",
                paddingTop: 60,
              }}
            >
              {connected
                ? "Waiting for log messages..."
                : "Connecting to WebSocket..."}
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={`${log.id}-${i}`} style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#555", minWidth: 70 }}>
                  {log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString()
                    : ""}
                </span>
                <span
                  style={{
                    color: levelColor(log.level),
                    fontWeight: 600,
                    minWidth: 45,
                  }}
                >
                  {log.level?.toUpperCase()}
                </span>
                {log.repository && (
                  <span style={{ color: "#8b5cf6" }}>[{log.repository}]</span>
                )}
                <span>{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
