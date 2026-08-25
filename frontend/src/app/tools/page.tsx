"use client";

import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  Layers,
  Play,
  RefreshCw,
  Search,
  Sliders,
  Terminal,
  Wrench,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAIContext } from "@/components/layout/AIContext";
import { Dropdown } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type {
  AgentToolDefinition,
  ObservatoryStats,
  ToolExecutionResult,
} from "@/services/tool.service";
import { toolService } from "@/services/tool.service";

const DEFAULT_TOOL_ARGS: Record<string, Record<string, unknown>> = {
  hybrid_search_knowledge_base: {
    query: "backup completed",
    limit: 5,
  },
  fetch_dashboard_statistics: {},
  fetch_backup_metrics: {
    limit: 5,
  },
  list_backup_runs: {
    limit: 5,
  },
  fetch_latest_backup_run: {},
  fetch_backup_run_details: {
    run_id: 1,
  },
  list_execution_logs: {
    limit: 10,
  },
  list_tracked_repositories: {},
  list_historical_analytics: {
    limit: 5,
  },
  fetch_latest_analytics_snapshot: {},
  fetch_analytics_for_run: {
    run_id: 1,
  },
  list_backup_fixes: {
    limit: 5,
  },
  fetch_backup_fix_details: {
    fix_id: 1,
  },
  send_report_email: {
    recipients: ["admin@domain.com"],
    subject: "Observatory Test Report",
  },
};

export default function ToolsPlaygroundPage() {
  const { auth, isAuthenticated } = useAIContext();

  const [tools, setTools] = useState<AgentToolDefinition[]>([]);
  const [selectedTool, setSelectedTool] = useState<AgentToolDefinition | null>(
    null,
  );
  const [loadingTools, setLoadingTools] = useState(true);
  const [toolsError, setToolsError] = useState<string | null>(null);

  const [argsJson, setArgsJson] = useState<string>("{}");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] =
    useState<ToolExecutionResult | null>(null);
  const [copiedResult, setCopiedResult] = useState(false);

  const [stats, setStats] = useState<ObservatoryStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sub-dropdown / Directory state
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);
  const [statsFilter, setStatsFilter] = useState<"all" | "used" | "unused">(
    "all",
  );
  const [searchFilter, setSearchFilter] = useState("");
  const workbenchRef = useRef<HTMLDivElement>(null);

  const loadTools = useCallback(async () => {
    try {
      setLoadingTools(true);
      setToolsError(null);
      const fetched = await toolService.fetchTools();
      setTools(fetched);
      if (fetched.length > 0) {
        setSelectedTool(fetched[0]);
        const defaultArgs = DEFAULT_TOOL_ARGS[fetched[0].name] || {};
        setArgsJson(JSON.stringify(defaultArgs, null, 2));
      }
    } catch (e) {
      setToolsError(
        e instanceof Error ? e.message : "Failed to load agent tools",
      );
    } finally {
      setLoadingTools(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const s = await toolService.fetchStats(auth?.token);
      setStats(s);
    } catch (e) {
      console.warn("Failed to load telemetry stats:", e);
    } finally {
      setLoadingStats(false);
      setIsRefreshing(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadTools();
    loadStats();
  }, [loadTools, loadStats]);

  const handleToolSelect = (tool: AgentToolDefinition) => {
    setSelectedTool(tool);
    const defaultArgs = DEFAULT_TOOL_ARGS[tool.name] || {};
    setArgsJson(JSON.stringify(defaultArgs, null, 2));
    setExecutionResult(null);
    workbenchRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleExecute = async () => {
    if (!selectedTool) return;
    if (!isAuthenticated || !auth?.token) {
      setExecutionResult({
        name: selectedTool.name,
        args: {},
        success: false,
        duration_ms: 0,
        result: null,
        error: "Authentication required to execute agent tools.",
      });
      return;
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      if (argsJson.trim()) {
        parsedArgs = JSON.parse(argsJson);
      }
    } catch {
      setExecutionResult({
        name: selectedTool.name,
        args: {},
        success: false,
        duration_ms: 0,
        result: null,
        error: "Invalid JSON in tool arguments input.",
      });
      return;
    }

    setIsExecuting(true);
    try {
      const res = await toolService.executeTool(
        auth.token,
        selectedTool.name,
        parsedArgs,
      );
      setExecutionResult(res);
      loadStats();
    } catch (e) {
      setExecutionResult({
        name: selectedTool.name,
        args: parsedArgs,
        success: false,
        duration_ms: 0,
        result: null,
        error: e instanceof Error ? e.message : "Tool invocation failed",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyResult = () => {
    if (!executionResult) return;
    navigator.clipboard.writeText(
      JSON.stringify(executionResult.result ?? executionResult.error, null, 2),
    );
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 2000);
  };

  // Compute all tools with merged telemetry status
  const toolsWithStats = useMemo(() => {
    return tools.map((t) => {
      const stat = stats?.tool_stats?.[t.name];
      const isUsed = !!stat && stat.invocations > 0;
      return {
        ...t,
        isUsed,
        stat: stat || {
          invocations: 0,
          total_duration_ms: 0,
          avg_duration_ms: 0,
          success_count: 0,
          failure_count: 0,
          success_rate: 0,
        },
      };
    });
  }, [tools, stats]);

  const usedCount = useMemo(
    () => toolsWithStats.filter((t) => t.isUsed).length,
    [toolsWithStats],
  );
  const unusedCount = useMemo(
    () => toolsWithStats.filter((t) => !t.isUsed).length,
    [toolsWithStats],
  );

  const filteredTools = useMemo(() => {
    return toolsWithStats.filter((t) => {
      if (statsFilter === "used" && !t.isUsed) return false;
      if (statsFilter === "unused" && t.isUsed) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [toolsWithStats, statsFilter, searchFilter]);

  return (
    <div className="page-container" style={{ paddingBottom: "80px" }}>
      <SectionHeader
        kicker="AGENTIC ASSISTANCE"
        title="Tools Playground & Telemetry"
        subtitle="Explore, inspect schemas, and interactively execute LangChain agent tools with real-time telemetry metrics."
      />

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
            {stats?.total_tool_calls ?? 0}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            Agent runtime executions
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
              Active Tools
            </span>
            <Activity size={16} style={{ color: "#34d399" }} />
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "#34d399",
            }}
          >
            {usedCount}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            Called in reasoning loops
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
              Unused Tools
            </span>
            <Layers size={16} style={{ color: "#9ca3af" }} />
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
            }}
          >
            {unusedCount}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            Awaiting invocation
          </div>
        </div>
      </div>

      {/* Main Interactive Tool Testing Workbench */}
      <div
        ref={workbenchRef}
        className="card"
        style={{ padding: "24px", marginBottom: "28px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Zap size={18} style={{ color: "var(--accent)" }} />
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text)",
                margin: 0,
              }}
            >
              Interactive Tool Execution
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setIsRefreshing(true);
              loadTools();
              loadStats();
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

        {loadingTools ? (
          <LoadingState message="Loading agent tools..." />
        ) : toolsError ? (
          <ErrorState message={toolsError} retry={loadTools} />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            {/* Tool Selection & Arguments */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <label
                  htmlFor="tool-select"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-muted)",
                    marginBottom: "8px",
                  }}
                >
                  Select Agent Tool
                </label>
                <Dropdown
                  options={tools.map((t) => ({
                    value: t.name,
                    label: t.name,
                    sublabel: t.description
                      ? `${t.description.slice(0, 60)}...`
                      : undefined,
                  }))}
                  value={selectedTool?.name || ""}
                  onChange={(val) => {
                    const match = tools.find((t) => t.name === val);
                    if (match) handleToolSelect(match);
                  }}
                  placeholder="Select a tool..."
                  searchable={true}
                  className="w-full"
                />
              </div>

              {selectedTool && (
                <div
                  style={{
                    background: "rgba(139, 124, 255, 0.04)",
                    border: "1px solid rgba(139, 124, 255, 0.18)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: "6px",
                    }}
                  >
                    <Code2 size={13} style={{ color: "var(--accent)" }} />
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent)",
                      }}
                    >
                      {selectedTool.name}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "12.5px",
                      color: "var(--text-secondary)",
                      margin: 0,
                      lineHeight: 1.45,
                    }}
                  >
                    {selectedTool.description || "No description provided."}
                  </p>
                </div>
              )}

              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <label
                    htmlFor="tool-arguments-editor"
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--text-muted)",
                    }}
                  >
                    Tool Arguments (JSON)
                  </label>
                  <span
                    style={{
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-muted)",
                    }}
                  >
                    JSON payload
                  </span>
                </div>
                <textarea
                  id="tool-arguments-editor"
                  className="input font-mono"
                  value={argsJson}
                  onChange={(e) => setArgsJson(e.target.value)}
                  rows={6}
                  style={{
                    width: "100%",
                    fontSize: "12px",
                    lineHeight: 1.45,
                    resize: "vertical",
                    background: "rgba(0, 0, 0, 0.3)",
                  }}
                  placeholder='{"param": "value"}'
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecute}
                disabled={isExecuting || !selectedTool}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  height: "38px",
                  fontWeight: 600,
                }}
              >
                {isExecuting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Executing Tool...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>Execute Tool</span>
                  </>
                )}
              </button>
            </div>

            {/* Execution Result Panel */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-muted)",
                  }}
                >
                  Execution Response
                </span>
                {executionResult && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCopyResult}
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Copy size={11} />
                    <span>{copiedResult ? "Copied" : "Copy JSON"}</span>
                  </button>
                )}
              </div>

              {executionResult ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "rgba(0, 0, 0, 0.2)",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      {executionResult.success ? (
                        <CheckCircle2 size={15} style={{ color: "#34d399" }} />
                      ) : (
                        <AlertCircle size={15} style={{ color: "#f87171" }} />
                      )}
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: executionResult.success
                            ? "#34d399"
                            : "#f87171",
                        }}
                      >
                        {executionResult.success
                          ? "Status: Success"
                          : "Status: Failed"}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Clock
                        size={12}
                        style={{ color: "var(--text-secondary)" }}
                      />
                      <span
                        style={{
                          fontSize: "11px",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {executionResult.duration_ms} ms
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "12px",
                      overflowX: "auto",
                      maxHeight: "360px",
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: "var(--font-mono)",
                        fontSize: "11.5px",
                        lineHeight: 1.45,
                        color: executionResult.success
                          ? "var(--text)"
                          : "#f87171",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {JSON.stringify(
                        executionResult.result ?? executionResult.error,
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    height: "100%",
                    minHeight: "240px",
                    border: "1px dashed var(--border)",
                    borderRadius: "6px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    padding: "24px",
                    textAlign: "center",
                  }}
                >
                  <Terminal
                    size={28}
                    style={{ opacity: 0.4, marginBottom: "8px" }}
                  />
                  <div style={{ fontSize: "13px", fontWeight: 500 }}>
                    No execution response yet
                  </div>
                  <div
                    style={{
                      fontSize: "11.5px",
                      color: "var(--text-secondary)",
                      marginTop: "4px",
                    }}
                  >
                    Select an agent tool, adjust parameters, and click Execute
                    Tool to see the live output.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sub-dropdown: Tool Telemetry & Usage Directory */}
      <div className="card" style={{ padding: "0", overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setIsStatsExpanded(!isStatsExpanded)}
          style={{
            width: "100%",
            padding: "18px 24px",
            background: "transparent",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            textAlign: "left",
            userSelect: "none",
          }}
          aria-expanded={isStatsExpanded}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <BarChart3 size={18} style={{ color: "var(--accent)" }} />
            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                Tool Telemetry & Usage Directory
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  marginTop: "2px",
                }}
              >
                Comprehensive directory of all {tools.length} registered tools
                and real-time execution statistics
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="badge badge-success font-mono">
              {usedCount} used
            </span>
            <span
              className="badge font-mono"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                color: "var(--text-muted)",
                border: "1px dashed var(--border)",
              }}
            >
              {unusedCount} not used yet
            </span>
            <ChevronDown
              size={16}
              style={{
                color: "var(--accent)",
                transform: isStatsExpanded ? "rotate(180deg)" : "none",
                transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>
        </button>

        {isStatsExpanded && (
          <div
            style={{
              borderTop: "1px solid var(--border)",
              padding: "20px 24px",
              background: "rgba(0, 0, 0, 0.15)",
            }}
          >
            {/* Filter controls */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className={`btn ${statsFilter === "all" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setStatsFilter("all")}
                  style={{ padding: "4px 12px", fontSize: "12px" }}
                >
                  All Tools ({tools.length})
                </button>
                <button
                  type="button"
                  className={`btn ${statsFilter === "used" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setStatsFilter("used")}
                  style={{ padding: "4px 12px", fontSize: "12px" }}
                >
                  Used ({usedCount})
                </button>
                <button
                  type="button"
                  className={`btn ${statsFilter === "unused" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setStatsFilter("unused")}
                  style={{ padding: "4px 12px", fontSize: "12px" }}
                >
                  Not Used Yet ({unusedCount})
                </button>
              </div>

              <div
                style={{
                  position: "relative",
                  minWidth: "220px",
                  flex: "1 1 auto",
                  maxWidth: "320px",
                }}
              >
                <Search
                  size={13}
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
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter directory..."
                  style={{
                    paddingLeft: 30,
                    height: 32,
                    fontSize: "12px",
                    width: "100%",
                  }}
                />
              </div>
            </div>

            {loadingStats && loadingTools ? (
              <LoadingState message="Loading directory telemetry..." />
            ) : filteredTools.length === 0 ? (
              <EmptyState
                icon={<Sliders size={28} />}
                message="No tools match the selected filter"
                description="Try clearing your search query or selecting a different status filter."
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
                            maxWidth: "300px",
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                            lineHeight: 1.4,
                          }}
                        >
                          {t.description || "—"}
                        </td>
                        <td>
                          {t.isUsed ? (
                            <span className="badge badge-info font-mono">
                              {t.stat.invocations} runs
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
                            fontSize: "12px",
                          }}
                        >
                          {t.isUsed
                            ? `${t.stat.avg_duration_ms.toFixed(1)} ms`
                            : "—"}
                        </td>
                        <td>
                          {t.isUsed ? (
                            <span
                              className={`badge ${t.stat.success_rate >= 90 ? "badge-success" : t.stat.success_rate >= 50 ? "badge-warning" : "badge-danger"} font-mono`}
                            >
                              {t.stat.success_rate.toFixed(1)}%
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>
                              —
                            </span>
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
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleToolSelect(t)}
                            style={{
                              padding: "3px 10px",
                              fontSize: "11.5px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Play size={10} />
                            <span>Test</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
