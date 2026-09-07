import { ChevronRight } from "lucide-react";

export function WorkflowDiagram({ activeStep }: { activeStep: string }) {
  const steps = [
    { key: "query", label: "Query received" },
    { key: "agent", label: "Agent reasoning" },
    { key: "tools", label: "Tool execution" },
    { key: "response", label: "Answering" },
  ];

  return (
    <div className="ai-workflow-container">
      <span
        style={{
          fontSize: "9px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-secondary)",
          marginRight: 8,
          flexShrink: 0,
        }}
      >
        Pipeline:
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          flex: 1,
          whiteSpace: "nowrap",
        }}
      >
        {steps.map((step, idx) => {
          const active = activeStep === step.key;
          return (
            <div
              key={step.key}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: active ? 600 : 400,
                  textShadow: active
                    ? "0 0 8px rgba(212, 168, 50, 0.3)"
                    : "none",
                  fontSize: "11px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {active && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--accent)",
                    }}
                  />
                )}
                {step.label}
              </span>
              {idx < steps.length - 1 && (
                <ChevronRight
                  size={11}
                  style={{ color: "var(--text-muted)", opacity: 0.4 }}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
