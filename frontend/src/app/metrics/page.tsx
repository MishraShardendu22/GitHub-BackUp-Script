"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Clock, CheckCircle2, XCircle } from "lucide-react";
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
  LineChart,
  Line,
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
      date: new Date(r.started_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      successful: r.successful,
      failed: r.failed,
      skipped: r.skipped,
      duration: Math.round(r.duration_ms / 1000),
      total: r.total_repos,
    })) ?? [];

  return (
    <div>
      <div
        style={{
          marginBottom: 32,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
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
            <BarChart3 size={28} /> Metrics & Analytics
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Backup performance trends and statistics
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={days === d ? "btn btn-primary" : "btn btn-outline"}
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div className="card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <TrendingUp size={14} /> Total Runs
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{data?.total_runs ?? 0}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={14} /> Avg Duration
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {data?.avg_duration_ms ? formatDuration(data.avg_duration_ms) : "N/A"}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={14} /> Successful
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>
            {data?.total_successful ?? 0}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <XCircle size={14} /> Failed
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>
            {data?.total_failed ?? 0}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            Success vs Failure per Run
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="date" stroke="#8888a0" fontSize={11} />
              <YAxis stroke="#8888a0" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#16161f",
                  border: "1px solid #2a2a3a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="successful" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="skipped" fill="#6b7280" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            Execution Duration (seconds)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="date" stroke="#8888a0" fontSize={11} />
              <YAxis stroke="#8888a0" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#16161f",
                  border: "1px solid #2a2a3a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="duration"
                stroke="#6366f1"
                fill="rgba(99, 102, 241, 0.1)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          Repos Processed per Run
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="date" stroke="#8888a0" fontSize={11} />
            <YAxis stroke="#8888a0" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "#16161f",
                border: "1px solid #2a2a3a",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="successful" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
