import { cn } from "@/lib/utils";

type MetricTone = "default" | "positive" | "critical" | "muted";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  tone?: MetricTone;
  compact?: boolean;
  className?: string;
}

const TONE: Record<MetricTone, string> = {
  default: "",
  positive: "m-metric__value--positive",
  critical: "m-metric__value--critical",
  muted: "m-metric__value--muted",
};

export function MetricCard({
  label,
  value,
  subtitle,
  tone = "default",
  compact = false,
  className,
}: MetricCardProps) {
  return (
    <div className={cn("m-metric", className)}>
      <p className="m-metric__label">{label}</p>
      <p
        className={cn(
          "m-metric__value",
          compact && "m-metric__value--sm",
          TONE[tone],
        )}
      >
        {value}
      </p>
      {subtitle && <p className="m-metric__note">{subtitle}</p>}
    </div>
  );
}
