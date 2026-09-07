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
    <div className={cn(className)} style={{ marginBottom: "28px" }}>
      {kicker && <div className="page-kicker">{kicker}</div>}
      <h1 className="hero-title" style={{ margin: "4px 0" }}>
        {title}
      </h1>
      {subtitle && (
        <p
          className="hero-subtitle"
          style={{ fontSize: "14px", color: "var(--text-secondary)" }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
