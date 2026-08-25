import { Bot, Sparkles } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { Message } from "@/types";
import { MessageContentRenderer } from "./MessageContentRenderer";
import { ToolActivityBlock } from "./ToolActivityBlock";

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
          <div
            style={{
              marginBottom: "12px",
              background: "var(--bg-primary)",
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid var(--card-border)",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <Sparkles size={12} /> Retrieved Hybrid Search Sources (
              {msg.sources.length})
            </span>
            {msg.sources.map((src, idx) => (
              <div
                key={
                  src.id
                    ? String(src.id)
                    : `${src.source_type}:${src.source_id}`
                }
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  marginBottom:
                    idx === (msg.sources?.length ?? 0) - 1 ? 0 : "6px",
                  borderBottom:
                    idx === (msg.sources?.length ?? 0) - 1
                      ? "none"
                      : "1px dashed var(--card-border)",
                  paddingBottom: "4px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    className="badge badge-info"
                    style={{ fontSize: "10px" }}
                  >
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
                  }}
                >
                  {src.content}
                </div>
              </div>
            ))}
          </div>
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
              {msg.iteration !== undefined
                ? `Agent reasoning (iteration ${msg.iteration + 1} of 5)...`
                : "Agent is starting reasoning workflow..."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
