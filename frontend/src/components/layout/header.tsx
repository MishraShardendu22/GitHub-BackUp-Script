"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/backups", label: "Backups" },
  { href: "/metrics", label: "Metrics" },
  { href: "/live", label: "Monitor" },
  { href: "/assistant", label: "AI" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header
      style={{
        padding: "20px 48px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid var(--border-light)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text)",
        }}
      >
        Backup Observatory
      </div>

      <nav
        style={{
          display: "flex",
          gap: 2,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 24,
          padding: 3,
        }}
      >
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "7px 18px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                transition: "all 0.15s",
                color: isActive ? "white" : "var(--text-secondary)",
                background: isActive ? "var(--text)" : "transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          padding: "4px 12px",
          border: "1px solid var(--border-light)",
          borderRadius: 6,
        }}
      >
        SSR
      </div>
    </header>
  );
}
