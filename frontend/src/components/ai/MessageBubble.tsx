import { Bot } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { Message } from "@/types";
import { MessageContentRenderer } from "./MessageContentRenderer";
import { ToolActivityBlock } from "./ToolActivityBlock";

export function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div className="flex flex-col items-end w-full gap-1 mb-6 px-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mr-1">
          <span>You</span>
          <span>·</span>
          <span>{formatTime(msg.timestamp)}</span>
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-5 py-3.5 shadow-sm">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start w-full gap-1 mb-6 px-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground ml-1">
        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary">
          <Bot className="h-3 w-3" />
        </div>
        <span className="font-semibold text-foreground">Observatory Agent</span>
        <span>·</span>
        <span>{formatTime(msg.timestamp)}</span>
      </div>

      <div className="w-full max-w-[95%] sm:max-w-[85%] mt-1 group">
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider pl-1">
              <span>Agent Tools Executed ({msg.toolCalls.length})</span>
              <div className="h-px flex-1 bg-border/50 ml-2" />
            </div>
            {msg.toolCalls.map((tool, idx) => (
              <ToolActivityBlock key={idx} tool={tool} />
            ))}
          </div>
        )}

        {msg.content ? (
          <div
            className={cn(
              "rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border",
              "bg-card text-foreground prose-p:leading-relaxed prose-pre:my-0 prose-pre:bg-muted/50",
            )}
          >
            <div className="relative ai-message-content">
              <MessageContentRenderer content={msg.content} />
              {msg.streaming && (
                <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/30 border border-dashed border-border text-sm text-muted-foreground w-fit">
            <div className="flex gap-1.5 items-center">
              <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
            </div>
            <span>
              {msg.iteration !== undefined
                ? `Reasoning iteration ${msg.iteration + 1} of 5...`
                : "Starting reasoning workflow..."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
