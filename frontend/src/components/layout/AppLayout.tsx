"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      <Sidebar
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300 ease-in-out",
          "md:ml-[var(--sidebar-width,280px)]",
        )}
      >
        {/* Mobile top navigation bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold tracking-tight">
            Observatory
          </span>
          <div className="w-9" /> {/* Spacer to center title */}
        </header>

        <main className="flex-1 overflow-auto bg-background/50">
          {children}
        </main>
      </div>
    </div>
  );
}
