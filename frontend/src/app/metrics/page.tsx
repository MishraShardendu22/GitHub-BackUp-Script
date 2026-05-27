"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/utils";
import type { MetricsData, BackupRun } from "@/lib/types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`${API}/api/metrics?days=${days}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [days]);

  const chartData =
    data?.runs.map((r: BackupRun) => ({
      date: new Date(r.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      successful: r.successful,
      failed: r.failed,
      duration: Math.round(r.duration_ms / 1000),
      total: r.total_repos,
    })) ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>
            ANALYTICS
          </div>
          <h1 style={{ fontSize: 36, fontFamily: "var(--font-serif)", marginBottom: 8 }}>
            Metrics
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Backup performance trends and operational statistics.
          </p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 3 }}>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: "5px 14px",
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                background: days === d ? "var(--text)" : "transparent",
                color: days === d ? "white" : "var(--text-secondary)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
        <div className="stat-card">
          <div className="stat-label">Total Runs</div>
          <div className="stat-value">{data?.total_runs ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Duration</div>
          <div className="stat-value">{data?.avg_duration_ms ? formatDuration(data.avg_duration_ms) : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Successful</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>{data?.total_successful ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed</div>
          <div className="stat-value" style={{ color: "var(--danger)" }}>{data?.total_failed ?? 0}</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Success vs failure</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2ddd5" />
              <XAxis dataKey="date" stroke="#9b9590" fontSize={11} />
              <YAxis stroke="#9b9590" fontSize={11} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2ddd5", borderRadius: 8, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }} />
              <Bar dataKey="successful" fill="#27ae60" radius={[3, 3, 0, 0]} />
              <Bar dataKey="failed" fill="#c0392b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Duration trend (seconds)</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2ddd5" />
              <XAxis dataKey="date" stroke="#9b9590" fontSize={11} />
              <YAxis stroke="#9b9590" fontSize={11} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2ddd5", borderRadius: 8, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }} />
              <Area type="monotone" dataKey="duration" stroke="#1a1a1a" fill="rgba(26, 26, 26, 0.05)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
