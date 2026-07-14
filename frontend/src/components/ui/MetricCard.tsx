import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  return (
    <Card
      className={cn(
        "shadow-sm hover:shadow transition-shadow bg-card",
        className,
      )}
    >
      <CardHeader className={cn(compact ? "p-4 pb-2" : "p-6 pb-2")}>
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(compact ? "p-4 pt-0" : "p-6 pt-0")}>
        <div
          className={cn(
            "font-bold text-foreground",
            compact ? "text-2xl" : "text-3xl",
          )}
        >
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}
