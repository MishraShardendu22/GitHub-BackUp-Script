import { cn } from "@/lib/utils";

export function SectionContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("section-container", className)}>{children}</section>
  );
}
