"use client";

import {
  Activity,
  Clock,
  Play,
  RefreshCw,
  Search,
  Sliders,
  Terminal,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAIContext } from "@/components/layout/AIContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type {
  AgentToolDefinition,
  ObservatoryStats,
} from "@/services/tool.service";
import { toolService } from "@/services/tool.service";

export default function ToolStatsPage() {
  const { auth } = useAIContext();

  const [tools, setTools] = useState<AgentToolDefinition[]>([]);
  const [stats, setStats] = useState<ObservatoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [filter, setFilter] = useState<"all" | "used" | "unused">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [fetchedTools, fetchedStats] = await Promise.all([
        toolService.fetchTools(),
        toolService.fetchStats(auth?.token),
      ]);
      setTools(fetchedTools);
      setStats(fetchedStats);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load telemetry stats",
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Merge tools list with database telemetry usage
  const mergedTools = useMemo(() => {
    const usageMap = new Map((stats?.tool_usage || []).map((u) => [u.name, u]));

    return tools.map((tool) => {
      const usage = usageMap.get(tool.name);
      const isUsed = !!usage && usage.count > 0;
      return {
        ...tool,
        isUsed,
        count: usage ? usage.count : 0,
        avgDuration: usage ? usage.avg_duration : 0,
        successRate: usage ? usage.success_rate : 0,
        successCount: usage ? usage.success_count : 0,
      };
    });
  }, [tools, stats]);

  const usedCount = useMemo(
    () => mergedTools.filter((t) => t.isUsed).length,
    [mergedTools],
  );
  const unusedCount = useMemo(
    () => mergedTools.filter((t) => !t.isUsed).length,
    [mergedTools],
  );

  const totalInvocations = useMemo(
    () => mergedTools.reduce((acc, t) => acc + t.count, 0),
    [mergedTools],
  );

  const avgSystemLatency = useMemo(() => {
    const used = mergedTools.filter((t) => t.isUsed);
    if (used.length === 0) return 0;
    const totalMs = used.reduce((acc, t) => acc + t.avgDuration * t.count, 0);
    return totalInvocations > 0 ? totalMs / totalInvocations : 0;
  }, [mergedTools, totalInvocations]);

  const filteredTools = useMemo(() => {
    return mergedTools.filter((t) => {
      if (filter === "used" && !t.isUsed) return false;
      if (filter === "unused" && t.isUsed) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mergedTools, filter, searchQuery]);

  return (
    <div className="page-container" style={{ paddingBottom: "80px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: "8px",
        }}
      >
        <SectionHeader
          kicker="AGENTIC ASSISTANCE"
          title="Tool Telemetry & Directory"
          subtitle="Real-time execution statistics, invocation frequency, and latency metrics across all Observatory agent tools."
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/tools"
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Play size={13} />
            <span>Open Tools Playground</span>
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setIsRefreshing(true);
              loadData();
            }}
            disabled={isRefreshing}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw
              size={13}
              className={isRefreshing ? "animate-spin" : ""}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div
        className="dashboard-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div className="card" style={{ padding: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              Registered Tools
            </span>
            <Wrench size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--text)",
            }}
          >
            {tools.length}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            {usedCount} used · {unusedCount} not used yet
          </div>
        </div>

        <div className="card" style={{ padding: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              Total Invocations
            </span>
            <Terminal size={16} style={{ color: "#38bdf8" }} />
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--text)",
            }}
          >
            {totalInvocations}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            Cumulative tool executions
          </div>
        </div>

        <div className="card" style={{ padding: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              Avg Tool Latency
            </span>
            <Clock size={16} style={{ color: "#34d399" }} />
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "#34d399",
            }}
          >
            {avgSystemLatency.toFixed(0)} ms
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            Across active executions
          </div>
        </div>

        <div className="card" style={{ padding: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              Active vs Unused
            </span>
            <Activity size={16} style={{ color: "#c084fc" }} />
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--text)",
            }}
          >
            {tools.length > 0
              ? `${((usedCount / tools.length) * 100).toFixed(0)}%`
              : "0%"}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            {usedCount} active / {unusedCount} pending
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ padding: "24px" }}>
        {/* Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className={`btn ${filter === "all" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilter("all")}
              style={{ padding: "6px 14px", fontSize: "13px" }}
            >
              All Tools ({tools.length})
            </button>
            <button
              type="button"
              className={`btn ${filter === "used" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilter("used")}
              style={{ padding: "6px 14px", fontSize: "13px" }}
            >
              Used ({usedCount})
            </button>
            <button
              type="button"
              className={`btn ${filter === "unused" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilter("unused")}
              style={{ padding: "6px 14px", fontSize: "13px" }}
            >
              Not Used Yet ({unusedCount})
            </button>
          </div>

          <div
            style={{
              position: "relative",
              minWidth: "240px",
              flex: "1 1 auto",
              maxWidth: "360px",
            }}
          >
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools by name or description..."
              style={{
                paddingLeft: 32,
                height: 36,
                fontSize: "13px",
                width: "100%",
              }}
            />
          </div>
        </div>

        {loading ? (
          <LoadingState message="Loading tool telemetry directory..." />
        ) : error ? (
          <ErrorState message={error} retry={loadData} />
        ) : filteredTools.length === 0 ? (
          <EmptyState
            icon={<Sliders size={32} />}
            message="No tools match the selected criteria"
            description="Adjust your search query or switch filters to view available agent tools."
          />
        ) : (
          <div className="ai-rich-table-container">
            <table className="ai-rich-table">
              <thead>
                <tr>
                  <th>Tool Name</th>
                  <th>Description</th>
                  <th>Invocations</th>
                  <th>Avg Latency</th>
                  <th>Success Rate</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTools.map((t) => (
                  <tr key={t.name}>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      <span
                        style={{
                          color: "var(--accent)",
                          fontWeight: 600,
                          fontSize: "13px",
                        }}
                      >
                        {t.name}
                      </span>
                    </td>
                    <td
                      style={{
                        maxWidth: "340px",
                        fontSize: "12.5px",
                        color: "var(--text-secondary)",
                        lineHeight: 1.45,
                      }}
                    >
                      {t.description || "—"}
                    </td>
                    <td>
                      {t.isUsed ? (
                        <span className="badge badge-info font-mono">
                          {t.count} runs
                        </span>
                      ) : (
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "12px",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          0 runs
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "12.5px",
                      }}
                    >
                      {t.isUsed ? `${t.avgDuration.toFixed(0)} ms` : "—"}
                    </td>
                    <td>
                      {t.isUsed ? (
                        <span
                          className={`badge ${t.successRate >= 90 ? "badge-success" : t.successRate >= 50 ? "badge-warning" : "badge-danger"} font-mono`}
                        >
                          {t.successRate.toFixed(1)}%
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td>
                      {t.isUsed ? (
                        <span className="badge badge-success">
                          <span
                            style={{
                              display: "inline-block",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#34d399",
                              marginRight: 5,
                            }}
                          />
                          Active
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(255, 255, 255, 0.04)",
                            color: "var(--text-muted)",
                            border: "1px dashed var(--border)",
                          }}
                        >
                          Not used yet
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/tools?tool=${encodeURIComponent(t.name)}`}
                        className="btn btn-secondary"
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Play size={11} />
                        <span>Test in Playground</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
