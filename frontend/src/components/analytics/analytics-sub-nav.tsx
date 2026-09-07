"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--border)",
        paddingBottom: 0,
        marginBottom: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              borderBottom: isActive
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              marginBottom: -1,
              transition: "color 0.15s, border-color 0.15s",
              whiteSpace: "nowrap",
            }}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
