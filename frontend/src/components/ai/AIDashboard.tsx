"use client";

import {
  Activity,
  Bot,
  Code,
  Database,
  FileText,
  History,
  MessageSquare,
  Send,
  Settings,
  Sparkles,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoginPanel, MessageBubble, WorkflowDiagram } from "@/components/ai";
import { useAIContext } from "@/components/layout/AIContext";
import { LoaderPanel } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LOADING_MESSAGES, PREMADE_PROMPTS } from "@/constants";
import { useChat } from "@/hooks/useChat";
import { useStats } from "@/hooks/useStats";
import { useStreamingAgent } from "@/hooks/useStreamingAgent";
import { cn } from "@/lib/utils";

export function AIDashboard() {
  const {
    auth,
    isAuthenticated,
    authLoading,
    authError,
    login,
    sessionsLoading,
    sessionsError,
    createSession,
    logout,
  } = useAIContext();

  const params = useParams();
  const _router = useRouter();

  const [localSessionId, setLocalSessionId] = useState<string | null>(null);

  useEffect(() => {
    setLocalSessionId(null);
  }, []);

  const activeSessionId =
    localSessionId || (params?.id as string | undefined) || null;
  const currentView = activeSessionId ? "chat" : "dashboard";

  const {
    stats,
    loading: statsLoading,
    refresh: refreshStats,
  } = useStats(auth.token);

  const [input, setInput] = useState("");
  const [loadMsg, setLoadMsg] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);

  const {
    messages,
    loading: messagesLoading,
    addMessage,
    updateMessage,
  } = useChat(auth.token, activeSessionId);

  const {
    sending,
    activeStep,
    activeConfirmation,
    sendMessage: sendStreamMessage,
    confirmAction,
  } = useStreamingAgent({
    onLogout: logout,
    onStatsRefresh: refreshStats,
  });

  const feedRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (statsLoading || sessionsLoading || messagesLoading) {
      setLoadMsg(
        LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)],
      );
    }
  }, [statsLoading, sessionsLoading, messagesLoading]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (
      sessionsError &&
      (sessionsError.includes("401") ||
        sessionsError.includes("Unauthorized") ||
        sessionsError.includes("credentials"))
    ) {
      logout();
    }
  }, [sessionsError, logout]);

  const handleSendMessage = async (question: string) => {
    if (!auth.token || !question.trim() || sending) return;

    let sessionId = activeSessionId;
    try {
      if (!sessionId) {
        const newSessionId = crypto.randomUUID();
        await createSession(
          newSessionId,
          question.trim().slice(0, 30) +
            (question.trim().length > 30 ? "..." : ""),
        );
        sessionId = newSessionId;
        window.history.replaceState(null, "", `/ai/${newSessionId}`);
        setLocalSessionId(newSessionId);
      }

      setHasInteracted(true);
      await sendStreamMessage(
        auth.token,
        question,
        sessionId,
        updateMessage,
        addMessage,
      );
      setInput("");
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("Failed to send message:", error);
      const msg = error.message;
      if (
        msg &&
        (msg.includes("401") ||
          msg.includes("Unauthorized") ||
          msg.includes("credentials"))
      ) {
        logout();
      } else {
        alert(msg || "An error occurred while communicating with the agent.");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b bg-card z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              GitHub Backup Observatory Agent
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75",
                    sending ? "animate-ping bg-amber-400" : "bg-emerald-400",
                  )}
                ></span>
                <span
                  className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    sending ? "bg-amber-500" : "bg-emerald-500",
                  )}
                ></span>
              </span>
              {sending
                ? "Processing Query..."
                : "Online · Ready to analyze telemetry"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 hidden md:flex">
          {sending && (
            <div className="w-[300px] border rounded-md bg-muted/30 px-3 py-1.5 shadow-inner">
              <WorkflowDiagram activeStep={activeStep} />
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span>Model:</span>
              <Badge
                variant="outline"
                className="font-mono bg-background text-primary border-primary/20"
              >
                {stats?.model_name || "loading..."}
              </Badge>
            </div>

            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleSendMessage(
                    "Generate a full backup health report and email it to me.",
                  )
                }
                disabled={sending}
                className="gap-2 text-primary border-primary/30 hover:bg-primary/10"
              >
                <FileText className="h-4 w-4" />
                Generate Report
              </Button>
            )}
          </div>
        </div>
      </header>

      <ScrollArea
        className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-32"
        ref={currentView === "chat" ? feedRef : undefined}
      >
        <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
          {currentView === "dashboard" ? (
            statsLoading && !stats ? (
              <div className="flex-1 flex items-center justify-center">
                <LoaderPanel message={loadMsg} />
              </div>
            ) : (
              <div className="flex flex-col gap-8 animate-in fade-in duration-500">
                <div className="text-center space-y-4 py-8">
                  <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-foreground">
                    Observatory Assistant
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Real-time analysis statistics from agent database
                    executions, success parameters, and tool call distribution
                    metrics.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-card shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex justify-between items-center">
                        Total Conversations
                        <MessageSquare className="h-4 w-4" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-3xl font-bold">
                        {stats?.total_conversations ?? 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex justify-between items-center">
                        Agent Executions
                        <History className="h-4 w-4" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-3xl font-bold">
                        {stats?.total_agent_runs ?? 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex justify-between items-center">
                        Model Success Rate
                        <Sparkles className="h-4 w-4" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-3xl font-bold text-emerald-500">
                        {stats ? `${stats.success_rate.toFixed(1)}%` : "100.0%"}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex justify-between items-center">
                        Database Memory
                        <Database className="h-4 w-4" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-3xl font-bold">
                        {stats?.memory_stats.total_messages ?? 0} msgs
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="shadow-sm">
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5 text-primary" />
                      Telemetry Tool Call Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="w-full overflow-auto">
                      <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b border-border/50 bg-muted/40">
                          <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                              Tool Name
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                              Invocations
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                              Avg Latency
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                              Success Rate
                            </th>
                          </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                          {stats?.tool_usage && stats.tool_usage.length > 0 ? (
                            stats.tool_usage.map((tool) => (
                              <tr
                                key={tool.name}
                                className="border-b border-border/50 transition-colors hover:bg-muted/30"
                              >
                                <td className="p-4 align-middle font-mono text-primary font-medium">
                                  {tool.name}
                                </td>
                                <td className="p-4 align-middle">
                                  {tool.count} runs
                                </td>
                                <td className="p-4 align-middle">
                                  {tool.avg_duration.toFixed(0)} ms
                                </td>
                                <td className="p-4 align-middle">
                                  <Badge
                                    variant={
                                      tool.success_rate > 90
                                        ? "default"
                                        : "destructive"
                                    }
                                    className={
                                      tool.success_rate > 90
                                        ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-emerald-500/20"
                                        : ""
                                    }
                                  >
                                    {tool.success_rate.toFixed(1)}%
                                  </Badge>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
                                className="p-8 text-center text-muted-foreground"
                              >
                                No tool call logs recorded in the database yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {!hasInteracted && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" /> Ask the Agent
                      About Backups
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PREMADE_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          className={cn(
                            "flex items-center gap-3 p-4 text-left border rounded-lg transition-all duration-200",
                            isAuthenticated
                              ? "bg-card hover:bg-primary/5 hover:border-primary/30 hover:shadow-sm"
                              : "bg-muted/50 opacity-60 cursor-not-allowed border-dashed",
                          )}
                          onClick={() => {
                            if (isAuthenticated) {
                              setInput(prompt);
                              composerRef.current?.focus();
                            }
                          }}
                          disabled={sending || !isAuthenticated}
                        >
                          <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary shrink-0">
                            <Sparkles className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-medium leading-relaxed flex-1">
                            {prompt}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
              {messagesLoading ? (
                <div className="flex justify-center items-center h-64 text-muted-foreground">
                  <LoaderPanel
                    message={loadMsg || "Retrieving conversation history..."}
                  />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center items-center h-64 text-muted-foreground bg-muted/30 rounded-xl border border-dashed p-8 text-center">
                  <div>
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>
                      No messages in this chat session yet. Ask a question below
                      to start.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}
              {/* Invisible element to scroll to */}
              <div ref={feedRef} className="h-4 w-full" />
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 w-full md:left-[var(--sidebar-width,280px)] md:w-[calc(100%-var(--sidebar-width,280px))] bg-gradient-to-t from-background via-background to-transparent pt-12 pb-6 px-4 md:px-8 z-20">
        <div className="max-w-4xl mx-auto w-full relative">
          {isAuthenticated ? (
            <form
              onSubmit={handleSubmit}
              className={cn(
                "flex flex-row items-end gap-3 p-2 bg-card border rounded-xl shadow-lg ring-1 ring-black/5 transition-all",
                "focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary",
              )}
            >
              <textarea
                ref={composerRef}
                className="flex-1 min-h-[44px] max-h-[200px] resize-none bg-transparent border-0 px-3 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                placeholder={
                  currentView === "dashboard"
                    ? "Type here to start a new analysis chat..."
                    : "Ask the agent anything about your backups..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(input);
                  }
                }}
                disabled={sending}
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                className={cn(
                  "h-[44px] w-[44px] rounded-lg shrink-0 transition-all",
                  input.trim()
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
                disabled={sending || !input.trim()}
              >
                {sending ? (
                  <Activity className="h-5 w-5 animate-pulse" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </form>
          ) : (
            <div className="w-full bg-card border rounded-xl shadow-lg overflow-hidden">
              <LoginPanel
                onLogin={login}
                loading={authLoading}
                error={authError}
              />
            </div>
          )}

          <div className="mt-2 text-center">
            <span className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
              <Bot className="h-3 w-3" />
              {sending
                ? "Agent is reasoning..."
                : "AI can make mistakes. Verify important backup information."}
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {activeConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border-primary/20">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-amber-500" />
                Confirm Sensitive Action
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-sm text-foreground mb-4">
                The agent wants to execute the tool{" "}
                <code className="px-1.5 py-0.5 rounded bg-muted text-primary font-mono text-xs">
                  {activeConfirmation.name}
                </code>{" "}
                to send an email report:
              </p>
              <div className="bg-muted/50 rounded-md p-4 text-sm space-y-3 border font-mono">
                <div>
                  <strong className="text-foreground">Subject:</strong>{" "}
                  <span className="text-muted-foreground">
                    {String(activeConfirmation.args?.subject || "")}
                  </span>
                </div>
                <div>
                  <strong className="text-foreground">Recipients:</strong>{" "}
                  <span className="text-muted-foreground">
                    {Array.isArray(activeConfirmation.args?.recipients)
                      ? activeConfirmation.args.recipients.join(", ")
                      : "Default Recipient (SMTP_TO)"}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => confirmAction(auth.token || "", true)}
                >
                  Yes, Send Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => confirmAction(auth.token || "", false)}
                >
                  No, Abort
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
