import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  kicker?: string;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  kicker,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 mb-6", className)}>
      {kicker && (
        <div className="text-xs font-bold tracking-wider text-primary uppercase">
          {kicker}
        </div>
      )}
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
