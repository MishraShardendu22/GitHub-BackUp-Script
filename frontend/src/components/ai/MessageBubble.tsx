import { Bot, ChevronDown, Database, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatTime } from "@/lib/utils";
import type { Message, SearchSource } from "@/types";
import { MessageContentRenderer } from "./MessageContentRenderer";
import { ToolActivityBlock } from "./ToolActivityBlock";

function RetrievedSourcesBlock({ sources }: { sources: SearchSource[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="m-panel" style={{ marginBottom: "12px" }}>
      <button
        type="button"
        className="m-panel__head"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label="Toggle retrieved hybrid search sources"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Database size={13} style={{ color: "var(--iris-500)" }} />
          <strong style={{ fontSize: "12.5px", color: "var(--text)" }}>
            Retrieved Hybrid Search Sources
          </strong>
          <span className="m-badge m-badge--quiet">
            {sources.length} chunk{sources.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            {expanded ? "Hide" : "Details"}
          </span>
          <ChevronDown
            size={12}
            style={{
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              color: "var(--iris-500)",
            }}
          />
        </div>
      </button>
      {expanded && (
        <div className="sources">
          {sources.map((src, idx) => (
            <div
              key={
                src.id
                  ? String(src.id)
                  : `${src.source_type}:${src.source_id}:${idx}`
              }
              className="source-chunk"
            >
              <div className="source-chunk__header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="m-tag">{src.source_type}</span>
                  {src.source_id && (
                    <span className="m-mono" title={src.source_id}>
                      #{src.source_id}
                    </span>
                  )}
                </div>
                <div className="m-tag">
                  <span className="m-caption">Score</span>
                  <span className="m-num">
                    {typeof src.score === "number"
                      ? src.score.toFixed(4)
                      : src.score}
                  </span>
                </div>
              </div>
              <div className="source-chunk__body">
                <code>{src.content}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({
  msg,
  isDeleting,
  onDelete,
}: {
  msg: Message;
  isDeleting?: boolean;
  onDelete?: (id: string) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className={`turn turn--user ${isDeleting ? "is-deleting" : ""}`}>
        <div
          className="turn__meta"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          {onDelete && !msg.streaming && (
            <button
              type="button"
              className="turn__delete"
              onClick={() => onDelete(msg.id)}
              title="Delete message"
              aria-label="Delete message"
            >
              <Trash2 size={11} />
            </button>
          )}
          <span>You · {formatTime(msg.timestamp)}</span>
        </div>
        <div className="turn__bubble">
          <p className="">{msg.content}</p>
        </div>
      </div>
    );
  }

  const runningTool = msg.toolCalls?.find((t) => t.running);

  return (
    <div className={`turn turn--assistant ${isDeleting ? "is-deleting" : ""}`}>
      <div className="turn__meta">
        <Bot
          size={13}
          style={{
            color: "var(--iris-500)",
            display: "inline-block",
            verticalAlign: "-2px",
            marginRight: 4,
          }}
        />{" "}
        Systems Lab Agent · {formatTime(msg.timestamp)}
      </div>
      <div className="turn__bubble">
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
                className="stream-cursor"
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
            <span className="stream-thinking" style={{ margin: 0 }}>
              <span />
              <span />
              <span />
            </span>
            <span>
              {runningTool
                ? `Executing tool: ${runningTool.name}...`
                : msg.toolCalls && msg.toolCalls.length > 0
                  ? `Analyzing tool results (turn ${(msg.iteration ?? 0) + 1} of 5)...`
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
