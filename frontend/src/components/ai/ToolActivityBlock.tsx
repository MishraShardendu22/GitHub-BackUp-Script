import { useState } from "react";
import type { MessageToolCall } from "@/types";

const ChevronIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
    aria-hidden="true"
  >
    <title>Chevron Icon</title>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export function ToolActivityBlock({ tool }: { tool: MessageToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ai-tool-activity-card">
      <button
        type="button"
        className="ai-tool-activity-header w-full flex items-center justify-between text-left"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`Toggle tool activity details for ${tool.name}`}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            className={`ai-tool-status-icon ${tool.running ? "running" : tool.success ? "success" : "error"}`}
          />
          <strong style={{ fontFamily: "monospace", color: "var(--accent)" }}>
            {tool.name}
          </strong>
          <span
            style={{
              marginLeft: 8,
              color: "var(--text-secondary)",
              fontSize: "11px",
            }}
          >
            {tool.running
              ? "Running…"
              : tool.success
                ? `Success (${tool.duration_ms ? tool.duration_ms.toFixed(0) : 0}ms)`
                : "Failed"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            {expanded ? "Hide" : "Details"}
          </span>
          <ChevronIcon />
        </div>
      </button>
      {expanded && (
        <div className="ai-tool-activity-details">
          <div>
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
              Arguments:
            </span>
            <pre className="ai-json-viewer">
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>
          {tool.result !== undefined && tool.result !== null && (
            <div>
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                Result:
              </span>
              <pre className="ai-json-viewer">
                {typeof tool.result === "string"
                  ? tool.result
                  : JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
          {tool.error && (
            <div>
              <span style={{ color: "#ef4444", fontWeight: 600 }}>Error:</span>
              <pre className="ai-json-viewer" style={{ color: "#f87171" }}>
                {tool.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
