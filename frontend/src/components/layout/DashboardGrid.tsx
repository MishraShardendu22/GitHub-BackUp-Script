import { cn } from "@/lib/utils";

export function DashboardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("ai-dashboard-grid", className)}>{children}</div>;
}
