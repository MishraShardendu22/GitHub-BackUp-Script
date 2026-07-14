import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MessageToolCall } from "@/types";

export function ToolActivityBlock({ tool }: { tool: MessageToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border/50 rounded-lg bg-muted/20 overflow-hidden mb-2 shadow-sm transition-all duration-200">
      <button
        type="button"
        className={cn(
          "w-full flex items-center justify-between p-3 text-left transition-colors hover:bg-muted/40",
          expanded && "border-b border-border/50 bg-muted/40",
        )}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          {tool.running ? (
            <Activity className="h-4 w-4 text-primary animate-pulse" />
          ) : tool.success ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          <span className="font-mono text-sm font-semibold text-foreground">
            {tool.name}
          </span>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              tool.running
                ? "bg-primary/10 text-primary"
                : tool.success
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-destructive/10 text-destructive",
            )}
          >
            {tool.running
              ? "Running…"
              : tool.success
                ? `${tool.duration_ms ? tool.duration_ms.toFixed(0) : 0}ms`
                : "Failed"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs font-medium uppercase tracking-wider">
            {expanded ? "Hide" : "Details"}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-3 bg-background space-y-3 border-t-2 border-t-primary/10">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Arguments
            </span>
            <pre className="text-[13px] bg-muted/50 p-3 rounded-md overflow-x-auto font-mono text-muted-foreground border border-border/50 leading-relaxed">
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>
          {tool.result !== undefined && tool.result !== null && (
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Result
              </span>
              <pre className="text-[13px] bg-muted/50 p-3 rounded-md overflow-x-auto font-mono text-foreground border border-border/50 leading-relaxed max-h-60">
                {typeof tool.result === "string"
                  ? tool.result
                  : JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
          {tool.error && (
            <div>
              <span className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1.5 block">
                Error
              </span>
              <pre className="text-[13px] bg-destructive/10 p-3 rounded-md overflow-x-auto font-mono text-destructive border border-destructive/20 leading-relaxed">
                {tool.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
