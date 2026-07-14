/**
 * MessageContentRenderer
 * A simple markdown-like renderer that formats:
 * - Code blocks
 * - Tables
 * - Basic headings (#, ##, ###)
 * - Lists
 * - Bold/Italics
 */

interface Block {
  type: "text" | "code" | "table";
  content: string;
  language?: string;
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let currentBlock: Block | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for code block start/end
    if (line.startsWith("```")) {
      if (currentBlock?.type === "code") {
        blocks.push(currentBlock);
        currentBlock = null;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = {
          type: "code",
          language: line.slice(3).trim(),
          content: "",
        };
      }
      continue;
    }

    // Accumulate code block content
    if (currentBlock?.type === "code") {
      currentBlock.content += (currentBlock.content ? "\n" : "") + line;
      continue;
    }

    // Basic table detection
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (currentBlock?.type !== "table") {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: "table", content: line };
      } else {
        currentBlock.content += `\n${line}`;
      }
      continue;
    }

    // Normal text
    if (currentBlock?.type !== "text") {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { type: "text", content: line };
    } else {
      currentBlock.content += `\n${line}`;
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

function renderMarkdownInline(text: string) {
  let result = text;
  // Bold
  result = result.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic
  result = result.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Inline code
  result = result.replace(/`(.*?)`/g, "<code>$1</code>");

  // biome-ignore lint/security/noDangerouslySetInnerHtml: We explicitly allow this for rich text rendering from the LLM
  return <span dangerouslySetInnerHTML={{ __html: result }} />;
}

export function MessageContentRenderer({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="flex flex-col gap-3 w-full max-w-full overflow-hidden">
      {blocks.map((block, idx) => {
        // Use index as key since the blocks are computed purely from static content string during render
        const key = `block-${idx}`;

        if (block.type === "code") {
          return (
            <div
              key={key}
              className="rounded-md border border-border/50 bg-muted/40 overflow-hidden my-2 max-w-full"
            >
              {block.language && (
                <div className="flex items-center justify-between px-4 py-1.5 bg-muted/80 border-b border-border/50 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  {block.language}
                </div>
              )}
              <div className="p-4 overflow-x-auto">
                <pre className="text-[13px] font-mono leading-relaxed text-foreground/90 whitespace-pre">
                  {block.content}
                </pre>
              </div>
            </div>
          );
        }

        if (block.type === "table") {
          const lines = block.content.split("\n");
          if (lines.length < 3) return <p key={key}>{block.content}</p>; // Not a full table

          const headerCells = lines[0]
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());
          const dataRows = lines
            .slice(2)
            .map((r) =>
              r
                .split("|")
                .slice(1, -1)
                .map((c) => c.trim()),
            )
            .filter((row) => row.length > 0);

          return (
            <div
              className="w-full overflow-x-auto my-3 border border-border/50 rounded-lg"
              key={key}
            >
              <table className="w-full caption-bottom text-sm text-left">
                <thead className="[&_tr]:border-b bg-muted/30">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    {headerCells.map((cell, cidx) => (
                      <th
                        key={`th-${key}-${cidx}`}
                        className="h-10 px-4 align-middle font-semibold text-foreground/90"
                      >
                        {renderMarkdownInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {dataRows.map((row, ridx) => (
                    <tr
                      key={`tr-${key}-${ridx}`}
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      {row.map((cell, cidx) => (
                        <td
                          key={`td-${key}-${ridx}-${cidx}`}
                          className="p-4 align-middle text-muted-foreground"
                        >
                          {renderMarkdownInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Text block
        const lines = block.content.split("\n");
        return (
          <div key={key} className="flex flex-col gap-1.5 w-full break-words">
            {lines.map((line, lidx) => {
              const lineKey = `line-${key}-${lidx}`;
              const trimmed = line.trim();
              if (trimmed.startsWith("# "))
                return (
                  <h3
                    key={lineKey}
                    className="text-lg font-bold text-foreground mt-4 mb-2 tracking-tight"
                  >
                    {renderMarkdownInline(trimmed.slice(2))}
                  </h3>
                );
              if (trimmed.startsWith("## "))
                return (
                  <h4
                    key={lineKey}
                    className="text-base font-bold text-foreground mt-3 mb-1"
                  >
                    {renderMarkdownInline(trimmed.slice(3))}
                  </h4>
                );
              if (trimmed.startsWith("### "))
                return (
                  <h5
                    key={lineKey}
                    className="text-sm font-bold text-foreground mt-2"
                  >
                    {renderMarkdownInline(trimmed.slice(4))}
                  </h5>
                );

              if (trimmed.startsWith("- ") || trimmed.startsWith("* "))
                return (
                  <li
                    key={lineKey}
                    className="ml-4 list-disc marker:text-primary/70 text-sm leading-relaxed"
                  >
                    {renderMarkdownInline(trimmed.slice(2))}
                  </li>
                );

              // Pseudo-metric parsing "Label: **Value**"
              if (trimmed.includes(": **") || trimmed.includes(":**")) {
                const parts = trimmed.split(/:\s?\*\*/);
                if (parts.length === 2) {
                  return (
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 border border-border/50 rounded-md w-fit my-0.5"
                      key={lineKey}
                    >
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {renderMarkdownInline(parts[0].replace("- ", ""))}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {renderMarkdownInline(`**${parts[1]}`)}
                      </span>
                    </div>
                  );
                }
              }

              if (!trimmed) return <div key={lineKey} className="h-2" />;

              return (
                <p
                  key={lineKey}
                  className="text-sm leading-relaxed m-0 text-foreground/90"
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
