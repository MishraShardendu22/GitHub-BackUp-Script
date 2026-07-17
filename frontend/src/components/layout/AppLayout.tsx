"use client";

import { Menu, Activity, Server } from "lucide-react";
import { useState } from "react";
import { AIContextProvider } from "./AIContext";
import Sidebar from "./sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AIContextProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </AIContextProvider>
  );
}

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      {/* Collapsible/Drawer Sidebar */}
      <Sidebar
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="app-content-wrapper">
        {/* Mobile top navigation bar */}
        <header className="mobile-header">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="mobile-menu-btn"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <span className="mobile-header-title">Systems Lab</span>
          <div style={{ width: 32 }} /> {/* Empty space to center title */}
        </header>
        {children}
      </div>
    </div>
  );
}