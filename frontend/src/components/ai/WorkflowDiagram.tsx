import { ArrowRight, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkflowDiagram({ activeStep }: { activeStep: string }) {
  const steps = [
    { key: "query", label: "Query" },
    { key: "agent", label: "Reasoning" },
    { key: "tools", label: "Tools" },
    { key: "response", label: "Answering" },
  ];

  return (
    <div className="flex items-center w-full h-full overflow-hidden">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-3 shrink-0">
        Pipeline
      </span>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 whitespace-nowrap">
        {steps.map((step, idx) => {
          const active = activeStep === step.key;
          return (
            <div key={step.key} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors duration-300",
                  active
                    ? "text-primary font-semibold drop-shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {active && <CircleDot className="h-3 w-3 animate-pulse" />}
                {step.label}
              </div>
              {idx < steps.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
