import { cn } from "@/lib/utils";

export function DashboardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("m-grid m-grid--metrics", className)}>{children}</div>
  );
}
