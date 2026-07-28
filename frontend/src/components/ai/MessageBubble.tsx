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
        <span style={{ color: "var(--accent)" }}>◆</span> Systems Lab Agent ·{" "}
        {formatTime(msg.timestamp)}
      </div>
      <div className="assistantBubble">
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
