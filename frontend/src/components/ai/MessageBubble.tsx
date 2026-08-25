import { Bot, ChevronDown, Database } from "lucide-react";
import { useState } from "react";
import { formatTime } from "@/lib/utils";
import type { Message, SearchSource } from "@/types";
import { MessageContentRenderer } from "./MessageContentRenderer";
import { ToolActivityBlock } from "./ToolActivityBlock";

function RetrievedSourcesBlock({ sources }: { sources: SearchSource[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="ai-tool-activity-card" style={{ marginBottom: "12px" }}>
      <button
        type="button"
        className="ai-tool-activity-header w-full flex items-center justify-between text-left"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label="Toggle retrieved hybrid search sources"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Database size={13} style={{ color: "var(--accent)" }} />
          <strong style={{ fontSize: "12px", color: "var(--text)" }}>
            Retrieved Hybrid Search Sources
          </strong>
          <span
            className="badge badge-info"
            style={{ fontSize: "10px", padding: "2px 6px" }}
          >
            {sources.length} chunk{sources.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            {expanded ? "Hide" : "Details"}
          </span>
          <ChevronDown
            size={12}
            style={{
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 0.2s ease",
            }}
          />
        </div>
      </button>
      {expanded && (
        <div className="ai-tool-activity-details">
          {sources.map((src, idx) => (
            <div
              key={
                src.id
                  ? String(src.id)
                  : `${src.source_type}:${src.source_id}:${idx}`
              }
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: idx === sources.length - 1 ? 0 : "8px",
                borderBottom:
                  idx === sources.length - 1
                    ? "none"
                    : "1px dashed var(--card-border)",
                paddingBottom: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span className="badge badge-info" style={{ fontSize: "10px" }}>
                  {src.source_type}
                </span>
                <span
                  style={{ color: "var(--text-muted)", fontSize: "10.5px" }}
                >
                  Score:{" "}
                  {typeof src.score === "number"
                    ? src.score.toFixed(4)
                    : src.score}
                </span>
              </div>
              <div
                style={{
                  marginTop: "4px",
                  color: "var(--text)",
                  fontSize: "12.5px",
                  lineHeight: 1.45,
                }}
              >
                {src.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div className="userBubbleWrap">
        <div className="msgHeader" style={{ textAlign: "right" }}>
          You · {formatTime(msg.timestamp)}
        </div>
        <div className="userBubble">
          <p className="userText">{msg.content}</p>
        </div>
      </div>
    );
  }

  const runningTool = msg.toolCalls?.find((t) => t.running);

  return (
    <div className="assistantWrap">
      <div className="msgHeader">
        <Bot
          size={13}
          style={{
            color: "var(--accent)",
            display: "inline-block",
            verticalAlign: "-2px",
            marginRight: 4,
          }}
        />{" "}
        Systems Lab Agent · {formatTime(msg.timestamp)}
      </div>
      <div className="assistantBubble">
        {msg.sources && msg.sources.length > 0 && (
          <RetrievedSourcesBlock sources={msg.sources} />
        )}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div style={{ marginBottom: "12px" }}>
            <span
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Agent Tool Calls ({msg.toolCalls.length})
            </span>
            {msg.toolCalls.map((tool) => (
              <ToolActivityBlock
                key={`${tool.name}-${JSON.stringify(tool.args)}`}
                tool={tool}
              />
            ))}
          </div>
        )}
        {msg.content ? (
          <div style={{ position: "relative" }}>
            <MessageContentRenderer content={msg.content} />
            {msg.streaming && (
              <span
                className="ai-cursor"
                aria-hidden="true"
                style={{ display: "inline-block", marginLeft: 4 }}
              />
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--text-secondary)",
              fontSize: "13.5px",
              padding: "4px 0",
            }}
          >
            <span className="ai-thinking" style={{ margin: 0 }}>
              <span />
              <span />
              <span />
            </span>
            <span>
              {runningTool
                ? `Executing tool: ${runningTool.name}...`
                : msg.iteration !== undefined
                  ? `Agent reasoning (turn ${msg.iteration + 1} of 5)...`
                  : "Agent is starting reasoning workflow..."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
