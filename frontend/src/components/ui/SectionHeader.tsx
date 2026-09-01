import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  kicker?: string;
  actions?: React.ReactNode;
  /** Renders the title as the page-level h1 rather than an in-page h2. */
  as?: "h1" | "h2";
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  kicker,
  actions,
  as = "h2",
  className,
}: SectionHeaderProps) {
  const Heading = as;
  return (
    <header className={cn("m-masthead", className)}>
      <div className="m-masthead__text">
        {kicker && <p className="m-kicker">{kicker}</p>}
        <Heading className={as === "h1" ? "m-title" : "m-section__title"}>
          {title}
        </Heading>
        {subtitle && <p className="m-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="m-masthead__actions">{actions}</div>}
    </header>
  );
}
