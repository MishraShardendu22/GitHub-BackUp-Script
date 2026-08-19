"use client";

import { Radio, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { env, WS_BASE_URL } from "@/config/env";
import type { WsMessage } from "@/types";

type LiveLog = WsMessage & { clientId: number };

function buildLiveSocketUrl() {
  const configuredBase = WS_BASE_URL;
  try {
    const baseUrl = new URL(
      configuredBase,
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:8080",
    );
    const secureProtocol =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "wss:"
        : "ws:";
    return `${secureProtocol}//${baseUrl.host}/ws/live`;
  } catch {
    const secureProtocol =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "wss:"
        : "ws:";
    const host =
      typeof window !== "undefined" ? window.location.host : "localhost:8080";
    return `${secureProtocol}//${host}/ws/live`;
  }
}

function levelColor(level?: string) {
  switch (level) {
    case "error":
      return "var(--danger)";
    case "warn":
      return "var(--warning)";
    case "info":
      return "var(--accent)";
    default:
      return "var(--text-muted)";
  }
}

export function LiveLogStream() {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LiveLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logSequenceRef = useRef(0);

  useEffect(() => {
    let disposed = false;

    function connect() {
      if (disposed) return;
      const ws = new WebSocket(buildLiveSocketUrl());
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!disposed)
          reconnectTimerRef.current = setTimeout(
            connect,
            env.WS_RECONNECT_DELAY_MS,
          );
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.type !== "log") return;
          setLogs((prev) => [
            ...prev.slice(-env.MAX_LIVE_LOGS_BUFFER),
            { ...msg, clientId: logSequenceRef.current++ },
          ]);
          window.requestAnimationFrame(() =>
            logsEndRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "end",
            }),
          );
        } catch {
          /* ignore */
        }
      };
    }
    connect();
    return () => {
      disposed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <>
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-kicker">Live Monitor</div>
          <h1 className="page-title">Real-time execution logs</h1>
          <p className="page-subtitle">
            A live stream of worker events from PostgreSQL-backed execution
            logs.
          </p>
        </div>
        <div
          className="pill status-pill"
          style={{
            alignSelf: "flex-start",
            cursor: "default",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connected ? "var(--success)" : "var(--danger)",
            }}
          />
          {connected ? "Connected" : "Disconnected"}
        </div>
      </div>

      <div className="card log-card" aria-live="polite">
        <div className="log-header">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            <Radio size={16} aria-hidden="true" />
            Log stream
          </span>
          <div
            style={{ display: "inline-flex", alignItems: "center", gap: 12 }}
          >
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {logs.length} entries
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={() => setLogs([])}
              aria-label="Clear live log entries"
              title="Clear log entries"
              disabled={logs.length === 0}
            >
              <RotateCcw size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="log-body">
          {logs.length === 0 ? (
            <div
              style={{
                fontSize: 15,
                color: "var(--text-muted)",
                textAlign: "center",
                paddingTop: 120,
              }}
            >
              {connected
                ? "Waiting for log messages..."
                : "Connecting to WebSocket..."}
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.clientId} className="log-row">
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString()
                    : ""}
                </span>
                <span
                  style={{
                    color: levelColor(log.level),
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {log.level?.toUpperCase()}
                </span>
                <span
                  className="truncate"
                  style={{ fontSize: 13, color: "var(--accent)", opacity: 0.8 }}
                >
                  {log.repository ? `[${log.repository}]` : "[system]"}
                </span>
                <span style={{ fontSize: 14, color: "var(--text)" }}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </>
  );
}
