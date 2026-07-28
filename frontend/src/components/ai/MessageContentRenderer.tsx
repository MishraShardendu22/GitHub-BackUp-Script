import React from "react";

function renderMarkdownInline(text: string): React.ReactNode {
  if (!text) return "";
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/);
  return (
    <>
      {parts.map((part, idx) => {
        const key = `inline-${idx}-${part.replace(/\s+/g, "_").slice(0, 10)}`;
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={key}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={key}>{part.slice(1, -1)}</em>;
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={key}
              style={{
                fontSize: "11px",
                background: "rgba(255, 255, 255, 0.08)",
                padding: "2px 4px",
                borderRadius: "3px",
                fontFamily: "monospace",
                textTransform: "none",
                color: "var(--accent)",
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <React.Fragment key={key}>{part}</React.Fragment>;
      })}
    </>
  );
}

export function MessageContentRenderer({ content }: { content: string }) {
  const parseBlocks = (text: string) => {
    const blocks: {
      type: "text" | "code" | "table";
      content: string;
      language?: string;
    }[] = [];
    const lines = text.split("\n");
    let inCode = false,
      codeLang = "",
      codeLines: string[] = [],
      inTable = false,
      tableLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("```")) {
        if (inCode) {
          blocks.push({
            type: "code",
            content: codeLines.join("\n"),
            language: codeLang,
          });
          codeLines = [];
          inCode = false;
        } else {
          inCode = true;
          codeLang = line.replace("```", "").trim();
        }
        continue;
      }
      if (inCode) {
        codeLines.push(line);
        continue;
      }
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        inTable = true;
        tableLines.push(line);
        continue;
      } else if (inTable) {
        blocks.push({ type: "table", content: tableLines.join("\n") });
        tableLines = [];
        inTable = false;
      }
      blocks.push({ type: "text", content: line });
    }
    if (inCode && codeLines.length > 0)
      blocks.push({
        type: "code",
        content: codeLines.join("\n"),
        language: codeLang,
      });
    if (inTable && tableLines.length > 0)
      blocks.push({ type: "table", content: tableLines.join("\n") });

    const merged: typeof blocks = [];
    for (const b of blocks) {
      const last = merged[merged.length - 1];
      if (last && last.type === "text" && b.type === "text")
        last.content += `\n${b.content}`;
      else merged.push(b);
    }
    return merged;
  };

  const blocks = parseBlocks(content);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {blocks.map((block, idx) => {
        const blockKey = `block-${idx}-${block.type}-${block.content.slice(0, 8)}`;
        if (block.type === "code") {
          return (
            <div key={blockKey}>
              <div className="ai-code-block-header">
                <span>{block.language || "code"}</span>
                <span>Copy</span>
              </div>
              <pre
                className="ai-code-block-body"
                style={{
                  fontFamily: "monospace",
                  background: "#0d0b0a",
                  padding: "12px",
                  borderRadius: "0 0 8px 8px",
                  overflowX: "auto",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderTop: "none",
                  fontSize: "12px",
                  margin: 0,
                }}
              >
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }
        if (block.type === "table") {
          const rows = block.content.split("\n");
          const headerCells = rows[0]
            .split("|")
            .map((c) => c.trim())
            .filter((_c, i, arr) => i > 0 && i < arr.length - 1);
          const dataRows = rows
            .slice(2)
            .map((row) =>
              row
                .split("|")
                .map((c) => c.trim())
                .filter((_c, i, arr) => i > 0 && i < arr.length - 1),
            )
            .filter((row) => row.length > 0);
          return (
            <div className="ai-rich-table-container" key={blockKey}>
              <table className="ai-rich-table">
                <thead>
                  <tr>
                    {headerCells.map((cell) => (
                      <th key={`hdr-${cell.replace(/\s+/g, "_")}`}>
                        {renderMarkdownInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row) => {
                    const rowKey = `row-${row.join("_").slice(0, 20)}`;
                    return (
                      <tr key={rowKey}>
                        {row.map((cell) => (
                          <td key={`cell-${rowKey}-${cell.slice(0, 10)}`}>
                            {renderMarkdownInline(cell)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }
        const lines = block.content.split("\n");
        return (
          <div
            key={blockKey}
            style={{ display: "flex", flexDirection: "column", gap: "6px" }}
          >
            {lines.map((line, lidx) => {
              const lineKey = `line-${lidx}-${line.slice(0, 12)}`;
              const trimmed = line.trim();
              if (trimmed.startsWith("# "))
                return (
                  <h3
                    key={lineKey}
                    style={{
                      fontSize: "18px",
                      color: "var(--accent)",
                      margin: "10px 0 4px",
                    }}
                  >
                    {renderMarkdownInline(trimmed.slice(2))}
                  </h3>
                );
              if (trimmed.startsWith("## "))
                return (
                  <h4
                    key={lineKey}
                    style={{
                      fontSize: "15px",
                      color: "var(--text)",
                      margin: "8px 0 4px",
                    }}
                  >
                    {renderMarkdownInline(trimmed.slice(3))}
                  </h4>
                );
              if (trimmed.startsWith("- ") || trimmed.startsWith("* "))
                return (
                  <li
                    key={lineKey}
                    style={{
                      marginLeft: "16px",
                      fontSize: "13px",
                      lineHeight: "1.6",
                    }}
                  >
                    {renderMarkdownInline(trimmed.slice(2))}
                  </li>
                );
              const metricRegex =
                /^(📊|📈|🔋|💾|⚙️)?\s*([^:]+):\s*([\d.,%]+|Healthy|Operational|Active|Failed)$/i;
              const match = trimmed.match(metricRegex);
              if (match) {
                const [, emoji, label, value] = match;
                return (
                  <div
                    className="ai-metric-stat-card"
                    style={{
                      display: "inline-flex",
                      flexDirection: "column",
                      width: "180px",
                      margin: "6px 6px 6px 0",
                      verticalAlign: "top",
                    }}
                    key={lineKey}
                  >
                    <span className="ai-metric-val">
                      {emoji ? `${emoji} ` : ""}
                      {value}
                    </span>
                    <span className="ai-metric-lbl">
                      {renderMarkdownInline(label)}
                    </span>
                  </div>
                );
              }
              return (
                <p
                  key={lineKey}
                  style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.6" }}
                >
                  {renderMarkdownInline(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
