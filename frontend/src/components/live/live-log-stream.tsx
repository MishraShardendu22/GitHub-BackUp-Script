"use client";

import { Activity, Terminal, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WsMessage } from "@/types";

function buildLiveSocketUrl() {
  const configuredBase =
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8080";
  const baseUrl = new URL(configuredBase);
  const secureProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${secureProtocol}//${baseUrl.host}/ws/live`;
}

function LevelBadge({ level }: { level?: string }) {
  switch (level?.toLowerCase()) {
    case "error":
      return (
        <span className="text-destructive font-bold text-xs uppercase w-12 shrink-0">
          ERROR
        </span>
      );
    case "warn":
      return (
        <span className="text-amber-500 font-bold text-xs uppercase w-12 shrink-0">
          WARN
        </span>
      );
    case "info":
      return (
        <span className="text-sky-400 font-bold text-xs uppercase w-12 shrink-0">
          INFO
        </span>
      );
    case "debug":
      return (
        <span className="text-muted-foreground font-bold text-xs uppercase w-12 shrink-0">
          DEBUG
        </span>
      );
    default:
      return (
        <span className="text-muted-foreground font-bold text-xs uppercase w-12 shrink-0">
          {level || "LOG"}
        </span>
      );
  }
}

export function LiveLogStream() {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<WsMessage[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(buildLiveSocketUrl());
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.type === "log") setLogs((prev) => [...prev.slice(-500), msg]);
        } catch {
          /* ignore */
        }
      };
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-3">
            Live Monitor
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Real-time execution logs
          </h1>
          <p className="text-muted-foreground mt-1">
            A live stream of worker events from PostgreSQL-backed execution
            logs.
          </p>
        </div>

        <Badge
          variant={connected ? "default" : "destructive"}
          className="px-3 py-1.5 gap-2 text-sm font-medium"
        >
          {connected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Connected
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              Disconnected
            </>
          )}
        </Badge>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Log stream</CardTitle>
          </div>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
            {logs.length} entries
          </span>
        </CardHeader>
        <CardContent className="p-0 flex-1 relative bg-zinc-950">
          <ScrollArea className="h-full w-full p-4 font-mono text-[13px] leading-relaxed">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 opacity-60 min-h-[400px]">
                <Activity className="h-8 w-8 animate-pulse" />
                <p>
                  {connected
                    ? "Waiting for log messages..."
                    : "Connecting to WebSocket..."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {logs.map((log, i) => (
                  <div
                    key={`${log.id}-${i}`}
                    className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-1.5 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors rounded px-2 -mx-2"
                  >
                    <div className="flex items-center gap-3 shrink-0 sm:w-[220px]">
                      <span className="text-zinc-500 text-xs shrink-0 tabular-nums">
                        {log.timestamp
                          ? new Date(log.timestamp).toLocaleTimeString()
                          : ""}
                      </span>
                      <LevelBadge level={log.level} />
                      <span
                        className="text-primary/80 text-xs truncate max-w-[120px]"
                        title={log.repository || "system"}
                      >
                        {log.repository ? `[${log.repository}]` : "[system]"}
                      </span>
                    </div>
                    <span className="text-zinc-300 break-all sm:break-words whitespace-pre-wrap ml-12 sm:ml-0">
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} className="h-4" />
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
