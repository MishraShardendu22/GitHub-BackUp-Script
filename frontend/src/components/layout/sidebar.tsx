"use client";

import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit2,
  FileCode,
  Folder,
  FolderOpen,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  type LucideProps,
  MessageSquare,
  Plus,
  Radio,
  Terminal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAIContext } from "./AIContext";

interface NavNode {
  label: string;
  href?: string;
  icon: React.ComponentType<LucideProps>;
  children?: NavNode[];
  representativeIcon?: React.ComponentType<LucideProps>;
}

const GitHubIcon = ({ size = 16, ...props }: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
  </svg>
);

// Tree structure for standard sections
const treeData: NavNode[] = [
  {
    label: "View the Codebase",
    href: "https://github.com/MishraShardendu22/github-backup-automation-system",
    icon: GitHubIcon,
  },
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Backups",
    href: "/backups",
    icon: History,
  },
  {
    label: "Analytics",
    icon: BarChart3,
    representativeIcon: BarChart3,
    children: [
      {
        label: "Overview",
        href: "/analytics",
        icon: BarChart3,
      },
      {
        label: "Run Logs",
        href: "/analytics/runs",
        icon: Terminal,
      },
      {
        label: "Git Snapshots",
        href: "/analytics/snapshots",
        icon: FileCode,
      },
    ],
  },
  {
    label: "Live Monitor",
    href: "/live",
    icon: Radio,
  },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Shared state from AIContext
  const {
    auth,
    isAuthenticated,
    sessions,
    sessionsLoading,
    createSession,
    renameSession,
    deleteSession,
    logout,
  } = useAIContext();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    Backups: true,
    Analytics: true,
    AIAssistant: true,
  });

  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null,
  );
  const [renameInput, setRenameInput] = useState("");

  // Hydrate collapsed state from localStorage
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  // Update CSS variable for layout margin-left
  useEffect(() => {
    if (mounted) {
      const width = isCollapsed ? "68px" : "280px";
      document.documentElement.style.setProperty("--sidebar-width", width);
    }
  }, [isCollapsed, mounted]);

  // Auto-expand folder nodes based on pathname
  useEffect(() => {
    setExpandedNodes((prev) => {
      const newExpanded = { ...prev };
      let changed = false;

      if (pathname.startsWith("/analytics") && !newExpanded.Analytics) {
        newExpanded.Analytics = true;
        changed = true;
      }
      if (pathname.startsWith("/backups") && !newExpanded.Backups) {
        newExpanded.Backups = true;
        changed = true;
      }
      if (pathname.startsWith("/ai") && !newExpanded.AIAssistant) {
        newExpanded.AIAssistant = true;
        changed = true;
      }

      return changed ? newExpanded : prev;
    });
  }, [pathname]);

  const toggleCollapse = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem("sidebar-collapsed", String(nextVal));
  };

  const toggleFolder = (label: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedNodes((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return pathname === "/";
    if (href === "/analytics") return pathname === "/analytics";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isFolderActive = (node: NavNode) => {
    if (!node.children) return false;
    return node.children.some((child) => isActive(child.href));
  };

  const isExternalLink = (href?: string) => !!href && /^https?:\/\//.test(href);

  const renderNavLink = (
    node: NavNode,
    className: string,
    extraStyle?: React.CSSProperties,
    iconSize = 18,
  ) => {
    const Icon = node.icon;
    const content = (
      <>
        <Icon size={iconSize} className="shrink-0" />
        {!isCollapsed && <span className="ml-3 truncate">{node.label}</span>}
      </>
    );

    const linkClasses = cn(
      "flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
      isActive(node.href)
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      isCollapsed && "justify-center px-0",
      className,
    );

    if (isExternalLink(node.href)) {
      return (
        <a
          key={node.label}
          href={node.href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
          style={extraStyle}
          onClick={onCloseMobile}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        key={node.label}
        href={node.href || "/"}
        className={linkClasses}
        style={extraStyle}
        onClick={onCloseMobile}
      >
        {content}
      </Link>
    );
  };

  // Create a new session and navigate to AI page
  const handleNewChat = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push("/ai");
      onCloseMobile?.();
      return;
    }
    const newSessionId = crypto.randomUUID();
    try {
      await createSession(newSessionId, "New Analysis Session");
      router.push(`/ai/${newSessionId}`);
      onCloseMobile?.();
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  // Delete session handler
  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteSession(id);
      if (pathname === `/ai/${id}`) {
        router.push("/ai");
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  // Rename session handler
  const handleRenameSession = async (id: string, name: string) => {
    try {
      await renameSession(id, name);
      setRenamingSessionId(null);
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
  };

  if (!mounted) {
    return (
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center justify-end px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronsLeft size={16} />
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile background overlay */}
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden cursor-default border-0"
          onClick={onCloseMobile}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onCloseMobile?.();
          }}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300 ease-in-out md:translate-x-0",
          isCollapsed ? "w-[68px]" : "w-[280px]",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-border/50">
          {!isCollapsed && (
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase truncate flex-1">
              Backup Observatory
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className={cn("h-8 w-8", isCollapsed && "mx-auto")}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronsRight size={16} />
            ) : (
              <ChevronsLeft size={16} />
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 py-4">
          <nav className="flex flex-col gap-1 px-3">
            {treeData.map((node) => {
              const hasChildren = node.children && node.children.length > 0;
              const nodeActive = hasChildren
                ? isFolderActive(node)
                : isActive(node.href);
              const Icon = node.icon;
              const RepIcon = node.representativeIcon || Icon;

              // Collapsed layout
              if (isCollapsed) {
                const mainHref = node.href || node.children?.[0]?.href || "/";
                return (
                  <div
                    key={node.label}
                    className="group relative flex justify-center py-1"
                  >
                    {isExternalLink(node.href) ? (
                      <a
                        href={node.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                          nodeActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        )}
                        onClick={onCloseMobile}
                      >
                        <RepIcon size={20} />
                      </a>
                    ) : (
                      <Link
                        href={mainHref}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                          nodeActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        )}
                        onClick={onCloseMobile}
                      >
                        <RepIcon size={20} />
                      </Link>
                    )}
                    <span className="absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block z-50">
                      {node.label}
                    </span>
                  </div>
                );
              }

              // Expanded Folder layout
              if (hasChildren && node.children) {
                const isOpen = !!expandedNodes[node.label];
                const FolderIcon = isOpen ? FolderOpen : Folder;

                return (
                  <div key={node.label} className="flex flex-col gap-1 py-1">
                    <button
                      type="button"
                      className={cn(
                        "flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        nodeActive
                          ? "bg-accent/50 text-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                      )}
                      onClick={(e) => toggleFolder(node.label, e)}
                    >
                      <span className="mr-2 shrink-0">
                        {isOpen ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </span>
                      <FolderIcon size={16} className="mr-3 shrink-0" />
                      <span className="truncate">{node.label}</span>
                    </button>

                    {isOpen && (
                      <div className="flex flex-col gap-1 pl-9 pr-1">
                        {node.children.map((child) => {
                          const childActive = isActive(child.href);
                          const ChildIcon = child.icon;

                          return (
                            <Link
                              key={child.href}
                              href={child.href || "/"}
                              className={cn(
                                "flex items-center w-full px-3 py-1.5 text-sm rounded-md transition-colors",
                                childActive
                                  ? "text-foreground font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                              )}
                              onClick={onCloseMobile}
                            >
                              <ChildIcon size={14} className="mr-3 shrink-0" />
                              <span className="truncate">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Expanded direct leaf layout
              return (
                <div key={node.label} className="py-1">
                  {renderNavLink(node, "")}
                </div>
              );
            })}

            {/* AI Assistant Section */}
            {isCollapsed ? (
              <div className="group relative flex justify-center py-1 mt-4 border-t border-border/50 pt-4">
                <Link
                  href="/ai"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                    pathname.startsWith("/ai")
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                  onClick={onCloseMobile}
                >
                  <MessageSquare size={20} />
                </Link>
                <span className="absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block z-50">
                  AI Assistant
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1 py-1 mt-4 border-t border-border/50 pt-4">
                <button
                  type="button"
                  className={cn(
                    "flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname.startsWith("/ai")
                      ? "bg-accent/50 text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                  onClick={(e) => toggleFolder("AIAssistant", e)}
                >
                  <span className="mr-2 shrink-0">
                    {expandedNodes.AIAssistant ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                  <span className="truncate font-semibold text-foreground flex-1 text-left">
                    AI Assistant
                  </span>
                </button>

                {expandedNodes.AIAssistant && (
                  <div className="flex flex-col gap-1 pl-4 pr-1 mt-1">
                    {/* Action 1: New Chat */}
                    <button
                      type="button"
                      onClick={handleNewChat}
                      disabled={!isAuthenticated}
                      className={cn(
                        "flex items-center w-full px-3 py-1.5 text-sm rounded-md transition-colors text-primary font-medium hover:bg-primary/10",
                        !isAuthenticated && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <Plus size={14} className="mr-3 shrink-0" />
                      <span className="truncate">New Analysis Chat</span>
                    </button>

                    {/* Action 2: Stats Dashboard */}
                    <button
                      type="button"
                      onClick={() => {
                        router.push("/ai");
                        onCloseMobile?.();
                      }}
                      className={cn(
                        "flex items-center w-full px-3 py-1.5 text-sm rounded-md transition-colors",
                        pathname === "/ai"
                          ? "text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                      )}
                    >
                      <LayoutDashboard size={14} className="mr-3 shrink-0" />
                      <span className="truncate">Stats Dashboard</span>
                    </button>

                    {/* Chat History Header */}
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-4 mb-1 px-3">
                      Chat History
                    </div>

                    {/* List of Chat Sessions */}
                    {sessionsLoading && sessions.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Syncing...
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="px-3 py-2 text-xs italic text-muted-foreground">
                        No active chats
                      </div>
                    ) : (
                      sessions.map((s) => {
                        const isSessionActive = pathname === `/ai/${s.id}`;

                        return (
                          <div
                            key={s.id}
                            className={cn(
                              "group flex items-center justify-between px-3 py-1.5 rounded-md transition-colors",
                              isSessionActive
                                ? "bg-accent/50 text-foreground"
                                : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                            )}
                          >
                            <Link
                              href={`/ai/${s.id}`}
                              onClick={(e) => {
                                if (renamingSessionId === s.id) {
                                  e.preventDefault();
                                } else {
                                  onCloseMobile?.();
                                }
                              }}
                              className="flex items-center gap-3 flex-1 min-w-0"
                            >
                              <MessageSquare size={14} className="shrink-0" />
                              {renamingSessionId === s.id ? (
                                <input
                                  type="text"
                                  // biome-ignore lint/a11y/noAutofocus: intentional focus for renaming
                                  autoFocus
                                  className="flex h-6 w-full rounded-sm border border-primary bg-background px-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                                  value={renameInput}
                                  onChange={(e) =>
                                    setRenameInput(e.target.value)
                                  }
                                  onBlur={() =>
                                    handleRenameSession(s.id, renameInput)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      handleRenameSession(s.id, renameInput);
                                    if (e.key === "Escape")
                                      setRenamingSessionId(null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span className="text-sm truncate">
                                  {s.session_name}
                                </span>
                              )}
                            </Link>

                            {/* Action Hover Controls */}
                            {renamingSessionId !== s.id && (
                              <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRenamingSessionId(s.id);
                                    setRenameInput(s.session_name);
                                  }}
                                  disabled={!isAuthenticated}
                                  className="p-1 text-muted-foreground hover:text-foreground rounded-sm hover:bg-background transition-colors"
                                  title="Rename Chat"
                                >
                                  <Edit2 size={12} />
                                </button>
                                {isAuthenticated && (
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleDeleteSession(s.id, e)
                                    }
                                    className="p-1 text-muted-foreground hover:text-destructive rounded-sm hover:bg-background transition-colors"
                                    title="Delete Chat"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>
        </ScrollArea>

        {/* User Profile / Auth Actions */}
        <div className="border-t border-border p-4 shrink-0">
          {isCollapsed ? (
            <div className="flex justify-center">
              {isAuthenticated ? (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={logout}
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </Button>
              ) : (
                <Button variant="outline" size="icon" asChild title="Sign In">
                  <Link href="/ai" onClick={onCloseMobile}>
                    <LogIn size={16} />
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              {isAuthenticated ? (
                <>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className="text-sm font-medium text-foreground truncate"
                      title={auth.username || ""}
                    >
                      {auth.username}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      Authenticated
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button className="w-full" size="sm" asChild>
                  <Link href="/ai" onClick={onCloseMobile}>
                    Sign In
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
