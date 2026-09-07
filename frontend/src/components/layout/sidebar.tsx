"use client";

import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
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
  Search,
  Terminal,
  Trash2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
    label: "Main Portfolio",
    href: "https://mishrashardendu22.is-a.dev",
    icon: ArrowLeft,
  },
  {
    label: "Tech Blog",
    href: "https://blogs.mishrashardendu22.is-a.dev",
    icon: BookOpen,
  },
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
    AgenticAssistance: true,
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
      if (
        (pathname.startsWith("/ai") ||
          pathname.startsWith("/tools") ||
          pathname === "/search-playground" ||
          pathname === "/embeddings") &&
        !newExpanded.AgenticAssistance
      ) {
        newExpanded.AgenticAssistance = true;
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

  const handleSidebarToggle = () => {
    if (window.matchMedia("(max-width: 768px)").matches) {
      onCloseMobile?.();
      return;
    }
    toggleCollapse();
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
        <span className="tree-node-icon">
          <Icon size={iconSize} />
        </span>
        <span className="tree-node-label">{node.label}</span>
      </>
    );

    if (isExternalLink(node.href)) {
      return (
        <a
          key={node.label}
          href={node.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
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
        className={className}
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

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Delete session handler with smooth UI collapse animation
  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setDeletingId(id);
      await new Promise((resolve) => setTimeout(resolve, 220));
      await deleteSession(id);
      if (pathname === `/ai/${id}`) {
        router.push("/ai");
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setDeletingId(null);
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
      <aside className="global-sidebar" style={{ width: "280px" }}>
        <div
          className="global-sidebar-header"
          style={{ justifyContent: "flex-end" }}
        >
          <button type="button" className="global-sidebar-toggle-btn">
            <ChevronsLeft size={16} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile background overlay */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click */}
      <div
        className={`sidebar-overlay ${isMobileOpen ? "mobile-open" : ""}`}
        onClick={onCloseMobile}
      />

      <aside
        id="app-navigation"
        aria-label="Primary navigation"
        className={`global-sidebar ${isMobileOpen ? "mobile-open" : ""}`}
        style={{
          width: isCollapsed ? "68px" : "280px",
        }}
      >
        {/* Sidebar Header */}
        <div
          className="global-sidebar-header"
          style={{
            justifyContent: isCollapsed ? "center" : "space-between",
            padding: isCollapsed ? "0" : "0 16px",
            gap: 8,
          }}
        >
          {!isCollapsed && (
            <div
              style={{
                fontWeight: 700,
                fontSize: "10px",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
              }}
              title="Systems Lab Agent"
            >
              Systems Lab
            </div>
          )}
          <button
            type="button"
            onClick={handleSidebarToggle}
            className="global-sidebar-toggle-btn"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse navigation"}
            title={isCollapsed ? "Expand sidebar" : "Collapse navigation"}
          >
            {isCollapsed ? (
              <ChevronsRight size={16} />
            ) : (
              <ChevronsLeft size={16} />
            )}
          </button>
        </div>

        <nav className="tree-nav">
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
                <div key={node.label} className="sidebar-tooltip-wrapper">
                  {isExternalLink(node.href) ? (
                    <a
                      href={node.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`tree-node ${nodeActive ? "active" : ""}`}
                      style={{ justifyContent: "center", padding: "10px 0" }}
                      onClick={onCloseMobile}
                    >
                      <RepIcon size={20} />
                    </a>
                  ) : (
                    <Link
                      href={mainHref}
                      className={`tree-node ${nodeActive ? "active" : ""}`}
                      style={{ justifyContent: "center", padding: "10px 0" }}
                      onClick={onCloseMobile}
                    >
                      <RepIcon size={20} />
                    </Link>
                  )}
                  <span className="sidebar-tooltip">
                    {node.label}
                    {hasChildren &&
                      node.children &&
                      ` (${node.children.map((c) => c.label).join(", ")})`}
                  </span>
                </div>
              );
            }

            // Expanded Folder layout
            if (hasChildren && node.children) {
              const isOpen = !!expandedNodes[node.label];
              const FolderIcon = isOpen ? FolderOpen : Folder;

              return (
                <div key={node.label} className="tree-node-wrapper">
                  <button
                    type="button"
                    className={`tree-node ${nodeActive ? "active" : ""}`}
                    onClick={(e) => toggleFolder(node.label, e)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      padding: "6px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <span className="tree-node-chevron">
                      {isOpen ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </span>
                    <span className="tree-node-icon">
                      <FolderIcon size={18} />
                    </span>
                    <span className="tree-node-label">{node.label}</span>
                  </button>

                  {isOpen && (
                    <div className="tree-children-container">
                      {node.children.map((child) => {
                        const childActive = isActive(child.href);
                        const ChildIcon = child.icon;

                        return (
                          <Link
                            key={child.href}
                            href={child.href || "/"}
                            className={`tree-node ${childActive ? "active" : ""}`}
                            onClick={onCloseMobile}
                          >
                            <span
                              className="tree-node-icon"
                              style={{ marginLeft: 4 }}
                            >
                              <ChildIcon size={16} />
                            </span>
                            <span
                              className="tree-node-label"
                              style={{ fontSize: "14px" }}
                            >
                              {child.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Expanded direct leaf layout
            return renderNavLink(
              node,
              `tree-node ${nodeActive ? "active" : ""}`,
              { paddingLeft: "26px" },
              18,
            );
          })}

          {/* DYNAMIC AGENTIC ASSISTANCE NODE (Consolidated Sidebar) */}
          {isCollapsed ? (
            <div className="sidebar-tooltip-wrapper">
              <Link
                href="/ai"
                className={`tree-node ${pathname.startsWith("/ai") || pathname.startsWith("/tools") || pathname === "/search-playground" || pathname === "/embeddings" ? "active" : ""}`}
                style={{ justifyContent: "center", padding: "10px 0" }}
                onClick={onCloseMobile}
              >
                <Bot size={20} />
              </Link>
              <span className="sidebar-tooltip">
                Agentic Assistance{" "}
                {sessions.length > 0 && `(${sessions.length} chats)`}
              </span>
            </div>
          ) : (
            <div className="tree-node-wrapper">
              {/* Folder Row header */}
              <button
                type="button"
                className={`tree-node ${pathname.startsWith("/ai") || pathname.startsWith("/tools") || pathname === "/search-playground" || pathname === "/embeddings" ? "active" : ""}`}
                onClick={(e) => toggleFolder("AgenticAssistance", e)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  padding: "6px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <span className="tree-node-chevron">
                  {expandedNodes.AgenticAssistance ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </span>
                <span className="tree-node-label" style={{ fontWeight: 600 }}>
                  Agentic Assistance
                </span>
              </button>

              {expandedNodes.AgenticAssistance && (
                <div className="tree-children-container">
                  {/* Action 1: New Chat */}
                  <button
                    type="button"
                    className="tree-node"
                    onClick={handleNewChat}
                    disabled={!isAuthenticated}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      padding: "5px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: isAuthenticated ? "pointer" : "not-allowed",
                      opacity: isAuthenticated ? 1 : 0.5,
                      color: "var(--accent)",
                    }}
                  >
                    <span className="tree-node-icon" style={{ marginLeft: 4 }}>
                      <Plus size={16} />
                    </span>
                    <span
                      className="tree-node-label"
                      style={{ fontSize: "14px", fontWeight: 600 }}
                    >
                      New Analysis Chat
                    </span>
                  </button>

                  {/* Action 2: Stats Dashboard */}
                  <button
                    type="button"
                    className={`tree-node ${pathname === "/ai" ? "active" : ""}`}
                    onClick={() => {
                      router.push("/ai");
                      onCloseMobile?.();
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      padding: "5px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <span className="tree-node-icon" style={{ marginLeft: 4 }}>
                      <LayoutDashboard size={15} />
                    </span>
                    <span
                      className="tree-node-label"
                      style={{ fontSize: "14px" }}
                    >
                      Stats Dashboard
                    </span>
                  </button>

                  {/* Link 3: Tools Playground */}
                  <Link
                    href="/tools"
                    className={`tree-node ${pathname === "/tools" ? "active" : ""}`}
                    onClick={onCloseMobile}
                    style={{
                      padding: "5px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="tree-node-icon" style={{ marginLeft: 4 }}>
                      <Wrench size={15} />
                    </span>
                    <span
                      className="tree-node-label"
                      style={{ fontSize: "14px" }}
                    >
                      Tools Playground
                    </span>
                  </Link>

                  {/* Link 4: Tool Telemetry */}
                  <Link
                    href="/tools/stats"
                    className={`tree-node ${pathname === "/tools/stats" ? "active" : ""}`}
                    onClick={onCloseMobile}
                    style={{
                      padding: "5px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="tree-node-icon" style={{ marginLeft: 4 }}>
                      <BarChart3 size={15} />
                    </span>
                    <span
                      className="tree-node-label"
                      style={{ fontSize: "14px" }}
                    >
                      Tool Telemetry
                    </span>
                  </Link>

                  {/* Link 5: Search Playground */}
                  <Link
                    href="/search-playground"
                    className={`tree-node ${pathname === "/search-playground" ? "active" : ""}`}
                    onClick={onCloseMobile}
                    style={{
                      padding: "5px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="tree-node-icon" style={{ marginLeft: 4 }}>
                      <Search size={15} />
                    </span>
                    <span
                      className="tree-node-label"
                      style={{ fontSize: "14px" }}
                    >
                      Search Playground
                    </span>
                  </Link>

                  {/* Link 5: Embeddings Playground */}
                  <Link
                    href="/embeddings"
                    className={`tree-node ${pathname === "/embeddings" ? "active" : ""}`}
                    onClick={onCloseMobile}
                    style={{
                      padding: "5px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="tree-node-icon" style={{ marginLeft: 4 }}>
                      <Database size={15} />
                    </span>
                    <span
                      className="tree-node-label"
                      style={{ fontSize: "14px" }}
                    >
                      Embeddings
                    </span>
                  </Link>

                  {/* Chat History Header */}
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-muted)",
                      padding: "10px 8px 2px 12px",
                    }}
                  >
                    Chat History
                  </div>

                  {/* List of Chat Sessions */}
                  {sessionsLoading && sessions.length === 0 ? (
                    <div
                      style={{
                        padding: "6px 12px",
                        color: "var(--text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      Syncing...
                    </div>
                  ) : sessions.length === 0 ? (
                    <div
                      style={{
                        padding: "6px 12px",
                        color: "var(--text-muted)",
                        fontSize: "11px",
                        fontStyle: "italic",
                      }}
                    >
                      No active chats
                    </div>
                  ) : (
                    sessions.map((s) => {
                      const isSessionActive = pathname === `/ai/${s.id}`;
                      const isSessionDeleting = deletingId === s.id;

                      return (
                        <div
                          key={s.id}
                          className={`tree-node ${isSessionActive ? "active" : ""} ${isSessionDeleting ? "sidebar-session-deleting" : ""}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "4px 8px",
                            position: "relative",
                          }}
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
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              flex: 1,
                              minWidth: 0,
                              cursor: "pointer",
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              textAlign: "left",
                              color: "inherit",
                              textDecoration: "none",
                            }}
                          >
                            <span
                              className="tree-node-icon"
                              style={{ marginLeft: 4 }}
                            >
                              <MessageSquare size={15} />
                            </span>
                            {renamingSessionId === s.id ? (
                              <input
                                type="text"
                                className="ai-session-rename-input"
                                value={renameInput}
                                onChange={(e) => setRenameInput(e.target.value)}
                                onBlur={() =>
                                  handleRenameSession(s.id, renameInput)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleRenameSession(s.id, renameInput);
                                  if (e.key === "Escape")
                                    setRenamingSessionId(null);
                                }}
                                style={{
                                  background: "rgba(0, 0, 0, 0.4)",
                                  border: "1px solid var(--accent)",
                                  color: "var(--text)",
                                  fontSize: "11px",
                                  padding: "1px 4px",
                                  borderRadius: "3px",
                                  width: "100%",
                                  outline: "none",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                className="tree-node-label"
                                style={{
                                  fontSize: "13.5px",
                                  textOverflow: "ellipsis",
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {s.session_name}
                              </span>
                            )}
                          </Link>

                          {/* Action Hover Controls */}
                          {renamingSessionId !== s.id && (
                            <div
                              className="sidebar-item-actions"
                              style={{
                                display: "flex",
                                gap: 2,
                                flexShrink: 0,
                              }}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setRenamingSessionId(s.id);
                                  setRenameInput(s.session_name);
                                }}
                                disabled={!isAuthenticated}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--text-muted)",
                                  padding: 2,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                                title="Rename Chat"
                              >
                                <Edit2 size={11} />
                              </button>
                              {isAuthenticated && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteSession(s.id, e)}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--text-muted)",
                                    padding: 2,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                  title="Delete Chat"
                                >
                                  <Trash2 size={11} />
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

        {/* User Profile / Auth Actions */}
        <div
          style={{
            padding: isCollapsed ? "12px 8px" : "12px 16px",
            borderTop: "1px solid var(--border-light)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            overflow: "hidden",
          }}
        >
          {isCollapsed ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={logout}
                  title="Sign Out"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-light)",
                    color: "var(--text-secondary)",
                    padding: "6px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <LogOut size={16} />
                </button>
              ) : (
                <Link
                  href="/ai"
                  onClick={onCloseMobile}
                  title="Sign In"
                  style={{
                    border: "1px solid var(--border-light)",
                    color: "var(--text-secondary)",
                    padding: "6px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <LogIn size={16} />
                </Link>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                minWidth: "248px",
              }}
            >
              {isAuthenticated ? (
                <>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--text)",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                    title={auth.username || ""}
                  >
                    {auth.username}
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--danger)";
                      e.currentTarget.style.borderColor = "var(--danger-bg)";
                      e.currentTarget.style.background = "var(--danger-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-secondary)";
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/ai"
                  onClick={onCloseMobile}
                  style={{
                    border: "1px solid var(--accent)",
                    color: "var(--accent)",
                    background: "var(--accent-bg)",
                    padding: "5px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "center",
                    width: "100%",
                    whiteSpace: "nowrap",
                  }}
                >
                  Sign In
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
