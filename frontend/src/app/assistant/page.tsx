"use client";

import { useEffect, useRef, useState } from "react";
import { getDashboardStats, getLatestReport, postChat, sendReport } from "@/lib/api";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils";
import type { ChatMessage, DashboardStats, ReportBundle } from "@/lib/types";
import styles from "./page.module.css";

const starterQuestions = [
  "Summarize the latest run in plain English.",
  "What are the most important findings from the latest snapshot?",
  "Are there any archive growth risks I should know about?",
  "What should I email right now?",
  "Use web search for extra context on this run.",
];

type ParsedReport = {
  summary?: string;
  findings?: string[];
  next_steps?: string[];
  risks?: string[];
  questions?: string[];
  sources?: string[];
};

type ParsedSource = {
  label: string;
  url?: string;
};

function parseSourceItem(source: string): ParsedSource {
  const markdownLink = source.match(/^(.+?)\s*\[(.+?)\]\((https?:\/\/[^)\s]+)\)$/);
  if (markdownLink) {
    return { label: markdownLink[2].trim(), url: markdownLink[3].trim() };
  }

  const urlMatch = source.match(/(https?:\/\/[^\s)]+)$/);
  if (urlMatch) {
    return {
      label: source.replace(urlMatch[1], "").replace(/[:\-–—]\s*$/, "").trim() || urlMatch[1],
      url: urlMatch[1],
    };
  }

  return { label: source };
}

export default function AssistantPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reportBundle, setReportBundle] = useState<ReportBundle | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => {});
    getLatestReport().then(setReportBundle).catch(() => {});
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function focusComposer() {
    composerRef.current?.focus();
  }

  function draftPrompt(prompt: string) {
    setInput(prompt);
    focusComposer();
  }

  function escapeHtml(str: string) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function convertMarkdownToHtml(text: string) {
    if (!text) return "";

    let escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    const lines = escaped.split(/\r?\n/);
    let out = "";
    let inList = false;

    for (const raw of lines) {
      const line = raw.trim();
      if (line.match(/^\-\s+/)) {
        if (!inList) {
          out += '<ul style="margin:6px 0 6px 18px;padding:0">';
          inList = true;
        }
        out += "<li>" + line.replace(/^\-\s+/, "") + "</li>";
      } else {
        if (inList) {
          out += "</ul>";
          inList = false;
        }
        if (line === "") {
          out += "<br/>";
        } else {
          out += '<p style="margin:6px 0;line-height:1.6">' + line + "</p>";
        }
      }
    }

    if (inList) out += "</ul>";
    return out;
  }

  function parseStructuredReport(text: string): ParsedReport | null {
    if (!text) return null;

    const lower = text.toLowerCase();
    if (
      !(
        lower.includes("**summary**") ||
        lower.includes("findings") ||
        lower.includes("next steps") ||
        lower.includes("risks") ||
        lower.includes("questions")
      )
    ) {
      return null;
    }

    const sections: ParsedReport = {};
    const norm = text.replace(/\r/g, "");
    const markers = [
      "**Summary**",
      "**Findings**",
      "**Next steps**",
      "**Risks**",
      "**Questions**",
      "**Sources**",
      "Sources:",
      "Sources",
    ];

    const parts: { [k: string]: string } = {};
    let lastMarker = "__start__";
    parts[lastMarker] = "";

    for (const line of norm.split("\n")) {
      const trimmed = line.trim();
      const marker = markers.find((mk) => trimmed.startsWith(mk));

      if (marker) {
        lastMarker = marker;
        parts[lastMarker] = trimmed.replace(marker, "").trim();
        continue;
      }

      parts[lastMarker] =
        (parts[lastMarker] || "") +
        (parts[lastMarker] === "" ? "" : "\n") +
        line;
    }

    function cleanInlineMarkdown(value: string) {
      return value
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
    }

    function extractList(s?: string) {
      if (!s) return [] as string[];
      const out: string[] = [];
      for (const line of s.split("\n")) {
        const t = line.trim();
        if (t === "") continue;

        const normalized = cleanInlineMarkdown(
          t
            .replace(/^[\-\*•]\s+/, "")
            .replace(/^\d+[\.)]\s+/, "")
        );

        if (normalized) {
          out.push(normalized);
        }
      }
      return out;
    }

    const sum = parts["**Summary**"] || parts["__start__"] || "";
    sections.summary = sum.trim();
    sections.findings = extractList(parts["**Findings**"]);
    sections.next_steps = extractList(parts["**Next steps**"]);
    sections.risks = extractList(parts["**Risks**"]);
    sections.questions = extractList(parts["**Questions**"]);
    if (parts["**Sources**"] || parts["Sources:"] || parts["Sources"]) {
      sections.sources = extractList(parts["**Sources**"] || parts["Sources:"] || parts["Sources"]);
    }

    return sections;
  }

  function ReportCard({ text }: { text: string }) {
    const parsed = parseStructuredReport(text);
    if (!parsed) {
      return (
        <div
          className={styles.fallbackMarkdown}
          dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(text) }}
        />
      );
    }

    const rawSummary = parsed.summary ?? "";
    const firstLine = rawSummary.split(/\r?\n/)[0] ?? "";
    const restSummary = rawSummary.split(/\r?\n/).slice(1).join("\n").trim();

    return (
      <div className={styles.reportFrame}>
        <div className={styles.reportTop}>
          <p className={styles.reportPromptTitle}>
            Which repositories show unusual growth this week?
          </p>
          <h3 className={styles.reportTitle}>{firstLine || "Assessment"}</h3>
          {restSummary ? <p className={styles.reportSummary}>{restSummary}</p> : null}
        </div>

        <div className={styles.reportGrid}>
          <div className={styles.reportCol}>
            <div className={styles.reportColTitle}>Findings</div>
            {parsed.findings && parsed.findings.length > 0 ? (
              <ul className={styles.reportList}>
                {parsed.findings.map((f, i) => (
                  <li key={i} className={styles.reportListItem}>
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.reportMuted}>No findings</p>
            )}
          </div>

          <div className={styles.reportCol}>
            <div className={styles.reportColTitle}>Next Steps</div>
            {parsed.next_steps && parsed.next_steps.length > 0 ? (
              <ul className={styles.reportList}>
                {parsed.next_steps.map((f, i) => (
                  <li key={i} className={styles.reportListItem}>
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.reportMuted}>No suggestions</p>
            )}
          </div>

          <div className={styles.reportCol}>
            <div className={styles.reportColTitle}>Risks</div>
            {parsed.risks && parsed.risks.length > 0 ? (
              <ul className={styles.reportList}>
                {parsed.risks.map((f, i) => (
                  <li key={i} className={styles.reportListItem}>
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.reportMuted}>No risks</p>
            )}
          </div>

          <div className={styles.reportCol}>
            <div className={styles.reportColTitle}>Questions</div>
            {parsed.questions && parsed.questions.length > 0 ? (
              <ul className={styles.reportList}>
                {parsed.questions.map((f, i) => (
                  <li key={i} className={styles.reportListItem}>
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.reportMuted}>No questions</p>
            )}
          </div>
        </div>

        {parsed.sources && parsed.sources.length > 0 ? (
          <div className={styles.sourcesWrap}>
            <span className={styles.sourcesLabel}>Sources</span>
            <ul className={styles.sourcesList}>
              {parsed.sources.map((source, index) => {
                const parsedSource = parseSourceItem(source);

                return (
                  <li key={index} className={styles.sourceItem}>
                    {parsedSource.url ? (
                      <a
                        className={styles.sourceLink}
                        href={parsedSource.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {parsedSource.label}
                      </a>
                    ) : (
                      <span className={styles.sourcesValue}>{parsedSource.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  async function refreshReport() {
    setReportLoading(true);
    setReportStatus("Generating the latest PDF preview and refreshing the report...");

    try {
      const [nextStats, nextReport] = await Promise.all([
        getDashboardStats(),
        getLatestReport(),
      ]);
      setStats(nextStats);
      setReportBundle(nextReport);
      setReportStatus("Latest report preview is ready.");
    } catch {
      setReportStatus("Could not refresh the report preview right now.");
    } finally {
      setReportLoading(false);
    }
  }

  async function sendLatestReport() {
    setReportLoading(true);
    setReportStatus("Generating the PDF and sending the email...");

    try {
      const payload = await sendReport("latest");

      if (payload.report) {
        setReportBundle(payload.report);
      } else {
        await refreshReport();
      }

      setReportStatus(`PDF generated and sent to ${payload.to}.`);
    } catch {
      setReportStatus("Could not generate and send the PDF right now.");
    } finally {
      setReportLoading(false);
    }
  }

  async function sendMessage(text?: string) {
    const messageText = (text ?? input).trim();

    if (!messageText || loading) {
      return;
    }

    setInput("");
    setLoading(true);
    setReportStatus(null);

    setMessages((previous) => [
      ...previous,
      {
        id: Date.now(),
        conversation_id: 0,
        role: "user",
        content: messageText,
        tokens_used: 0,
        web_search: webSearch,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const response = await postChat(messageText, undefined, webSearch);

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          conversation_id: response.conversation_id,
          role: "assistant",
          content: response.message,
          tokens_used: response.tokens_used,
          web_search: response.web_search,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          conversation_id: 0,
          role: "assistant",
          content:
            "The AI service is unavailable right now. Check that the backend is running and try again.",
          tokens_used: 0,
          web_search: false,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const reportHeadline = reportBundle?.headline ?? "Waiting for the latest report";
  const reportSummary =
    reportBundle?.summary ??
    "Generate the PDF to see the current run summary here.";

  return (
    <div className={styles.pageWrap}>
      <section className={styles.assessmentShell}>
        <div className={styles.heroRow}>
          <div>
            <p className={styles.kicker}>Assessment Studio</p>
            <h1 className={styles.pageTitle}>Backup Risk Assessment</h1>
            <p className={styles.pageSubtitle}>
              Ask direct questions about your latest run and get an executive-style
              assessment with findings, next steps, and risks.
            </p>
          </div>

          <div className={styles.headerMeta}>
            <span className={styles.statusPill}>
              {stats?.last_run_status ?? "No run yet"}
            </span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={sendLatestReport}
              disabled={reportLoading}
            >
              {reportLoading ? "Working..." : "Generate PDF & Email"}
            </button>
          </div>
        </div>

        <div className={styles.composerWrap}>
          <textarea
            ref={composerRef}
            className={styles.composer}
            placeholder="Ask a question (e.g. 'Which repositories show unusual growth this week?')"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            disabled={loading}
          />

          <div className={styles.composerActions}>
            <label className={styles.webSearchLabel}>
              <input
                type="checkbox"
                checked={webSearch}
                onChange={(e) => setWebSearch(e.target.checked)}
              />
              Use web search
            </label>

            <button
              type="button"
              className={styles.sendBtn}
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
            >
              {loading ? "Generating..." : "Send Question"}
            </button>
          </div>
        </div>

        <p className={styles.promptHint}>
          Premade questions are shown first so you can jump straight into the
          most common backup-review flows.
        </p>

        <div className={styles.premadeGrid}>
          {starterQuestions.map((question) => (
            <button
              key={question}
              type="button"
              className={styles.premadeBtn}
              onClick={() => draftPrompt(question)}
            >
              {question}
            </button>
          ))}
        </div>

        {reportStatus ? <p className={styles.reportStatus}>{reportStatus}</p> : null}

        {messages.length > 0 ? (
          <div className={styles.chatFeed}>
            {messages.map((message) => {
              const isUser = message.role === "user";

              return (
                <article
                  key={message.id}
                  className={isUser ? styles.userBubbleWrap : styles.assistantWrap}
                >
                  <div className={styles.msgHeader}>
                    {isUser ? "You" : "Assistant"}
                    {message.role === "assistant" && message.web_search
                      ? " · web search"
                      : ""}
                  </div>

                  <div className={isUser ? styles.userBubble : styles.assistantBubble}>
                    {message.role === "assistant" ? (
                      <ReportCard text={message.content} />
                    ) : (
                      <p className={styles.userText}>{message.content}</p>
                    )}
                  </div>

                  <div className={styles.msgMeta}>
                    {formatDate(message.created_at)}
                    {message.role === "assistant" && message.tokens_used > 0
                      ? ` · ${message.tokens_used} tokens`
                      : ""}
                  </div>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <section className={styles.previewCard}>
            <p className={styles.previewKicker}>Latest Report Preview</p>
            <h2 className={styles.previewHeadline}>{reportHeadline}</h2>
            <p className={styles.previewSummary}>{reportSummary}</p>

            <div className={styles.previewStats}>
              <div className={styles.previewStatItem}>
                <span>Total Repositories</span>
                <strong>{stats?.total_repos ?? 0}</strong>
              </div>
              <div className={styles.previewStatItem}>
                <span>Total Size</span>
                <strong>{formatBytes(stats?.total_size_bytes ?? 0)}</strong>
              </div>
              <div className={styles.previewStatItem}>
                <span>Avg Duration</span>
                <strong>{formatDuration(stats?.avg_duration_ms ?? 0)}</strong>
              </div>
            </div>
          </section>
        )}

        {loading ? (
          <p className={styles.loadingState}>Thinking through the latest data...</p>
        ) : null}

        <button
          type="button"
          className={styles.focusJump}
          onClick={focusComposer}
          aria-label="Focus question input"
        >
          Ask another question
        </button>
      </section>
    </div>
  );
}
