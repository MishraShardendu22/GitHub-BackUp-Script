"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SITE } from "@/constants/site";
import { AIContextProvider } from "./AIContext";
import { SiteFooter } from "./SiteFooter";
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
  const pathname = usePathname();

  /* The agent console owns the viewport instead of scrolling inside the page
     column, and it has no room for a footer. */
  const isConsole = pathname?.startsWith("/ai") ?? false;

  useEffect(() => {
    if (!isMobileOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  return (
    <div className="m-shell">
      <Sidebar
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className={`m-sidebar-scrim${isMobileOpen ? " is-open" : ""}`}
        onClick={() => setIsMobileOpen(false)}
      />

      <div className="m-shell__body">
        <header className="m-topbar m-topbar--mobile">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="m-icon-btn"
            aria-label="Open navigation menu"
            aria-controls="app-navigation"
            aria-expanded={isMobileOpen}
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <span className="m-wordmark">
            <span className="m-wordmark__mark" aria-hidden="true">
              SL
            </span>
            <span className="m-wordmark__name">{SITE.name}</span>
          </span>
          <span aria-hidden="true" style={{ width: "2.25rem" }} />
        </header>

        <main
          id="main-content"
          className={isConsole ? "m-main m-main--flush" : "m-main"}
        >
          {children}
        </main>

        {!isConsole && <SiteFooter />}
      </div>
    </div>
  );
}
