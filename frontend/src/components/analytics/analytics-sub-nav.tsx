"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/analytics", label: "Overview" },
  { href: "/analytics/runs", label: "Run History" },
  { href: "/analytics/snapshots", label: "Git Snapshots" },
];

export function AnalyticsSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Analytics sections"
      className="flex gap-2 border-b border-border/50 pb-0 mb-2 overflow-x-auto no-scrollbar"
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
