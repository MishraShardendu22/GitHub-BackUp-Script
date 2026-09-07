import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  className?: string;
  compact?: boolean;
}

export function MetricCard({
  label,
  value,
  subtitle,
  className,
  compact,
}: MetricCardProps) {
  if (compact) {
    return (
      <div className={cn("stat-card stat-card--compact", className)}>
        <div className="stat-label">{label}</div>
        <div className="stat-value stat-value--md">{value}</div>
        {subtitle && (
          <div className="text-xs text-muted" style={{ marginTop: 6 }}>
            {subtitle}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("ai-dashboard-card", className)}>
      <div className="ai-card-title">{label}</div>
      <div className="ai-card-value">{value}</div>
      {subtitle && (
        <div className="text-xs text-muted" style={{ marginTop: 6 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
