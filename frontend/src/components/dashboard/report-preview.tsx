import type { ReportBundle } from "@/lib/types";

interface ReportPreviewProps {
  report: ReportBundle;
}

export function ReportPreview({ report }: ReportPreviewProps) {
  return (
    <section className="card" style={{ padding: 24, display: "grid", gap: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="section-title">Latest report</div>
          <h3 style={{ fontSize: 28, marginBottom: 8 }}>{report.headline}</h3>
          <p
            style={{
              maxWidth: 840,
              color: "var(--text-secondary)",
              lineHeight: 1.8,
            }}
          >
            {report.summary}
          </p>
        </div>
        <div className="pill" style={{ cursor: "default" }}>
          {new Date(report.generated_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {report.metrics.map((metric) => (
          <div key={metric.label} className="stat-card" style={{ padding: 16 }}>
            <div className="stat-label">{metric.label}</div>
            <div className="stat-value" style={{ fontSize: 22 }}>
              {metric.value}
            </div>
            {metric.detail ? (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                {metric.detail}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <ReportSection title="Findings" items={report.findings} />
        <ReportSection title="Next steps" items={report.next_steps} />
        <ReportSection title="Risks" items={report.risks} />
        <ReportSection title="Questions" items={report.questions} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div className="card-flat" style={{ padding: 18 }}>
          <div className="section-title">Top repositories</div>
          <div className="section-desc" style={{ marginBottom: 12 }}>
            Largest stored archives in the latest snapshot.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {report.repositories.length > 0 ? (
              report.repositories.map((repository) => (
                <div
                  key={repository.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    paddingBottom: 10,
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{repository.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {repository.status} · {repository.commit_hash.slice(0, 10) || "n/a"}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {repository.archive_size}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No repository data available.</div>
            )}
          </div>
        </div>

        <div className="card-flat" style={{ padding: 18 }}>
          <div className="section-title">Recent failures</div>
          <div className="section-desc" style={{ marginBottom: 12 }}>
            Only stored failure records from the latest report scope.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {report.failures.length > 0 ? (
              report.failures.map((failure) => (
                <div
                  key={`${failure.repository}-${failure.created_at}`}
                  style={{
                    paddingBottom: 10,
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{failure.repository}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {failure.message}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                No failure records were found for this report.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReportSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card-flat" style={{ padding: 18 }}>
      <div className="section-title">{title}</div>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item}
              style={{
                padding: "12px 14px",
                border: "1px solid var(--border-light)",
                borderRadius: 12,
                background: "var(--bg-card)",
                lineHeight: 1.7,
                color: "var(--text)",
              }}
            >
              {item}
            </div>
          ))
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No items.</div>
        )}
      </div>
    </div>
  );
}
