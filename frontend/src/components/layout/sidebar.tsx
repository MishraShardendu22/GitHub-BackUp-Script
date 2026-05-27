"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  History,
  BarChart3,
  Radio,
  Bot,
  GitBranch,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/backups", label: "Backup History", icon: History },
  { href: "/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/live", label: "Live Monitor", icon: Radio },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 240,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
      }}
    >
      <div
        style={{
          padding: "20px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <GitBranch size={24} style={{ color: "var(--accent)" }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Backup Monitor</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            GitHub Repository Backup
          </div>
        </div>
      </div>

      <nav style={{ padding: "12px 8px", flex: 1 }}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 2,
                textDecoration: "none",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: isActive ? "rgba(99, 102, 241, 0.08)" : "transparent",
                transition: "all 0.15s",
              }}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          padding: "16px",
          borderTop: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-secondary)",
        }}
      >
        v1.0.0 • Built with Go + Next.js
      </div>
    </aside>
  );
}
