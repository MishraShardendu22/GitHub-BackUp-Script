"use client";

import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { PaginationBar } from "@/components/analytics/pagination-bar";
import { formatDate, formatDuration } from "@/lib/utils";
import { backupService } from "@/services/backup.service";
import type { BackupFix, BackupRun } from "@/types";

interface BackupsClientProps {
  initialData: {
    data: BackupRun[];
    pagination: {
      page: number;
      limit: number;
      total_items: number;
      total_pages: number;
    };
  };
}

export default function BackupsClient({ initialData }: BackupsClientProps) {
  const [runs, setRuns] = useState<BackupRun[]>(initialData.data);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [currentPage, setCurrentPage] = useState(initialData.pagination.page);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states
  const [activeFix, setActiveFix] = useState<BackupFix | null>(null);
  const [createFixForRun, setCreateFixForRun] = useState<BackupRun | null>(
    null,
  );

  // Form states for Create Fix
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCommit, setFormCommit] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const [formAffected, setFormAffected] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit Fix states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCommit, setEditCommit] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editAffected, setEditAffected] = useState<number[]>([]);

  const hasToken =
    typeof window !== "undefined" && !!localStorage.getItem("agent_token");

  // Fetch runs on page change
  const fetchPage = async (page: number) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await backupService.getRuns(page, pagination.limit);
      setRuns(result.data);
      setPagination(result.pagination);
      setCurrentPage(page);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load backups",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Sync with initial page in case props change
    setRuns(initialData.data);
    setPagination(initialData.pagination);
    setCurrentPage(initialData.pagination.page);
  }, [initialData]);

  // Open Create Fix form modal
  const openCreateFix = (run: BackupRun) => {
    setCreateFixForRun(run);
    setFormTitle("");
    setFormDesc("");
    setFormCommit("");
    setFormAuthor("Shardendu Mishra"); // Default author based on context
    setFormAffected([run.id]);
    setSubmitError(null);
  };

  // Toggle affected run selection in Create Fix form
  const toggleAffectedRun = (runId: number) => {
    if (formAffected.includes(runId)) {
      setFormAffected(formAffected.filter((id) => id !== runId));
    } else {
      setFormAffected([...formAffected, runId]);
    }
  };

  // Handle Create Fix submission
  const handleCreateFixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setSubmitError("Title is required");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await backupService.createFix({
        title: formTitle,
        description: formDesc,
        commitHash: formCommit,
        author: formAuthor,
        affectedRuns: formAffected,
      });

      // Close modal
      setCreateFixForRun(null);

      // Refresh list to show updated fixes/badges
      await fetchPage(currentPage);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create fix",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to determine if a run is failed
  const isFailedRun = (run: BackupRun) => {
    return run.status === "failed" || run.failed > 0;
  };

  // Find other failed runs in the current loaded page (excluding current one) to display as checkboxes
  const otherFailedRuns = runs.filter(
    (run) =>
      isFailedRun(run) && createFixForRun && run.id !== createFixForRun.id,
  );

  // Edit Fix handlers
  const startEditing = () => {
    if (!activeFix) return;
    setEditTitle(activeFix.title || "");
    setEditDesc(activeFix.description || "");
    setEditCommit(activeFix.commit_hash || "");
    setEditAuthor(activeFix.author || "");
    setEditAffected(activeFix.affected_runs || []);
    setIsEditing(true);
    setSubmitError(null);
  };

  const handleEditFixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFix) return;
    if (!editTitle.trim()) {
      setSubmitError("Title is required");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const updatedFix = await backupService.updateFix(activeFix.id, {
        title: editTitle,
        description: editDesc,
        commitHash: editCommit,
        author: editAuthor,
        affectedRuns: editAffected,
      });

      // Update the active fix state
      setActiveFix(updatedFix);
      setIsEditing(false);

      // Refresh list to show updated fixes/badges
      await fetchPage(currentPage);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to update fix",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEditAffectedRun = (runId: number) => {
    if (editAffected.includes(runId)) {
      setEditAffected(editAffected.filter((id) => id !== runId));
    } else {
      setEditAffected([...editAffected, runId]);
    }
  };

  // Get all unique failed runs we can choose from during editing
  const pageFailedRuns = runs.filter(isFailedRun);
  const allAvailableFailedRuns = [...pageFailedRuns];
  for (const id of editAffected) {
    if (!allAvailableFailedRuns.some((r) => r.id === id)) {
      allAvailableFailedRuns.push({
        id,
        status: "failed",
        started_at: "",
        completed_at: null,
        total_repos: 0,
        successful: 0,
        failed: 1,
        skipped: 0,
        duration_ms: 0,
        error_message: "",
      });
    }
  }
  allAvailableFailedRuns.sort((a, b) => b.id - a.id);

  return (
    <>
      <div className="m-card m-card--flush">
        {errorMessage ? (
          <p
            style={{
              color: "var(--critical-500)",
              padding: 40,
              textAlign: "center",
              fontSize: 15,
            }}
          >
            {errorMessage}
          </p>
        ) : loading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--text-secondary)",
            }}
          >
            <span className="m-body">Loading runs...</span>
          </div>
        ) : runs.length === 0 ? (
          <p
            className="text-sm m-text-muted"
            style={{ padding: 40, textAlign: "center" }}
          >
            No backup runs found. Run the worker to create backups.
          </p>
        ) : (
          <div className="m-table-wrap">
            <table className="m-table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Run</th>
                  <th style={{ whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ whiteSpace: "nowrap" }}>Date</th>
                  <th style={{ whiteSpace: "nowrap" }}>Duration</th>
                  <th style={{ whiteSpace: "nowrap" }}>Total</th>
                  <th style={{ whiteSpace: "nowrap" }}>Success</th>
                  <th style={{ whiteSpace: "nowrap" }}>Failed</th>
                  <th style={{ whiteSpace: "nowrap" }}>Skipped</th>
                  <th style={{ whiteSpace: "nowrap" }}>Fix Status</th>
                  <th
                    style={{
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const hasFixes = run.fixes && run.fixes.length > 0;
                  const failed = isFailedRun(run);

                  return (
                    <tr key={run.id}>
                      <td data-label="Run" style={{ fontWeight: 500 }}>
                        #{run.id}
                      </td>
                      <td data-label="Status">
                        <span
                          className={`m-badge ${
                            run.status === "completed"
                              ? "m-badge--positive"
                              : run.status === "running"
                                ? "m-badge--accent"
                                : "m-badge--critical"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td
                        data-label="Date"
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "13.5px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(run.started_at)}
                      </td>
                      <td data-label="Duration">
                        {formatDuration(run.duration_ms)}
                      </td>
                      <td data-label="Total">{run.total_repos}</td>
                      <td
                        data-label="Success"
                        style={{ color: "var(--positive-500)" }}
                      >
                        {run.successful}
                      </td>
                      <td
                        data-label="Failed"
                        style={{
                          color:
                            run.failed > 0 ? "var(--critical-500)" : "inherit",
                        }}
                      >
                        {run.failed}
                      </td>
                      <td data-label="Skipped" className="m-text-muted">
                        {run.skipped}
                      </td>
                      <td data-label="Fix Status">
                        {failed ? (
                          hasFixes ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveFix(run.fixes?.[0] ?? null)
                              }
                              className="m-badge"
                              style={{
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#10b981",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                cursor: "pointer",
                                fontSize: "12px",
                                padding: "2px 8px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle2
                                size={12}
                                style={{ color: "#10b981" }}
                              />{" "}
                              Fixed
                            </button>
                          ) : (
                            <span
                              className="m-badge"
                              style={{
                                background: "rgba(239, 68, 68, 0.1)",
                                color: "var(--critical-500)",
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                                fontSize: "12px",
                                padding: "2px 8px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontWeight: 600,
                              }}
                            >
                              <XCircle
                                size={12}
                                style={{ color: "var(--critical-500)" }}
                              />{" "}
                              Failed
                            </span>
                          )
                        ) : (
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "13px",
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td
                        data-label="Actions"
                        style={{ textAlign: "right", whiteSpace: "nowrap" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "flex-end",
                            alignItems: "center",
                          }}
                        >
                          {failed && !hasFixes && (
                            <button
                              type="button"
                              onClick={() => openCreateFix(run)}
                              className="m-btn m-btn--secondary"
                              style={{
                                padding: "6px 12px",
                                fontSize: "12px",
                                borderColor: "rgba(139, 92, 246, 0.4)",
                                color: "var(--iris-500)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Create Fix
                            </button>
                          )}
                          {failed && hasFixes && (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveFix(run.fixes?.[0] ?? null)
                              }
                              className="m-btn m-btn--secondary"
                              style={{
                                padding: "6px 12px",
                                fontSize: "12px",
                                borderColor: "rgba(16, 185, 129, 0.4)",
                                color: "#10b981",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Details
                            </button>
                          )}
                          <Link
                            href={`/backups/${run.id}`}
                            className="m-btn m-btn--ghost"
                            style={{
                              padding: "6px 10px",
                              fontSize: "13px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pagination && (
              <div style={{ padding: "0 16px 16px" }}>
                <PaginationBar
                  page={currentPage}
                  totalPages={pagination.total_pages}
                  pageSize={pagination.limit}
                  totalItems={pagination.total_items}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* -- Modal dialog: View / Edit Fix Details ----------------------------- */}
      {activeFix && (
        <button
          type="button"
          aria-label="Close modal overlay backdrop"
          className="m-scrim block w-full border-none p-0 text-left"
          onClick={() => {
            setActiveFix(null);
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setActiveFix(null);
              setIsEditing(false);
            }
          }}
        >
          <div className="m-dialog" role="dialog" aria-modal="true">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h3
                style={{ fontSize: 18, fontWeight: 600, color: "var(--text)" }}
              >
                {isEditing ? "Edit Resolution Details" : "Resolution Details"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setActiveFix(null);
                  setIsEditing(false);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                &times;
              </button>
            </div>

            {isEditing ? (
              <form
                onSubmit={handleEditFixSubmit}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div>
                  <label
                    htmlFor="edit-fix-title"
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Title{" "}
                    <span style={{ color: "var(--critical-500)" }}>*</span>
                  </label>
                  <input
                    id="edit-fix-title"
                    type="text"
                    className="m-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-fix-desc"
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    id="edit-fix-desc"
                    className="m-textarea"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div>
                    <label
                      htmlFor="edit-fix-commit"
                      style={{
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Commit Hash
                    </label>
                    <input
                      id="edit-fix-commit"
                      type="text"
                      className="m-input"
                      value={editCommit}
                      onChange={(e) => setEditCommit(e.target.value)}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-fix-author"
                      style={{
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Author
                    </label>
                    <input
                      id="edit-fix-author"
                      type="text"
                      className="m-input"
                      value={editAuthor}
                      onChange={(e) => setEditAuthor(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Select Affected Failed Runs
                  </span>
                  <div
                    style={{
                      maxHeight: 120,
                      overflowY: "auto",
                      background: "rgba(0,0,0,0.15)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-md)",
                      padding: "8px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {allAvailableFailedRuns.length > 0 ? (
                      allAvailableFailedRuns.map((run) => (
                        <label
                          key={run.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 14,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={editAffected.includes(run.id)}
                            onChange={() => toggleEditAffectedRun(run.id)}
                          />
                          <span>
                            Run #{run.id}{" "}
                            {run.started_at
                              ? `(${formatDate(run.started_at)})`
                              : "(Linked Run)"}
                          </span>
                        </label>
                      ))
                    ) : (
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "var(--text-muted)",
                          padding: "4px 0",
                        }}
                      >
                        No failed runs available to select.
                      </div>
                    )}
                  </div>
                </div>

                {submitError && (
                  <div
                    style={{
                      color: "var(--critical-500)",
                      fontSize: 14,
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <AlertCircle size={15} /> {submitError}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 12,
                    marginTop: 12,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="m-btn m-btn--secondary"
                    style={{ padding: "10px 18px", fontSize: 14 }}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="m-btn m-btn--primary"
                    style={{ padding: "10px 18px", fontSize: 14 }}
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        display: "block",
                      }}
                    >
                      Title
                    </span>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 500,
                        color: "#10b981",
                        marginTop: 4,
                      }}
                    >
                      {activeFix.title}
                    </div>
                  </div>

                  <div>
                    <span
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        display: "block",
                      }}
                    >
                      Description
                    </span>
                    <p
                      style={{
                        fontSize: 14.5,
                        color: "var(--text-secondary)",
                        marginTop: 4,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {activeFix.description || "No description provided."}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 16,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          display: "block",
                        }}
                      >
                        Commit Hash
                      </span>
                      <div
                        style={{
                          fontSize: 14,
                          fontFamily: "monospace",
                          color: "var(--text)",
                          marginTop: 4,
                        }}
                      >
                        {activeFix.commit_hash ? (
                          <span
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {activeFix.commit_hash}
                          </span>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          display: "block",
                        }}
                      >
                        Author
                      </span>
                      <div
                        style={{
                          fontSize: 14.5,
                          color: "var(--text)",
                          marginTop: 4,
                        }}
                      >
                        {activeFix.author || "—"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 16,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          display: "block",
                        }}
                      >
                        Created At
                      </span>
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--text-secondary)",
                          marginTop: 4,
                        }}
                      >
                        {formatDate(activeFix.created_at)}
                      </div>
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          display: "block",
                        }}
                      >
                        Affected Runs
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          marginTop: 4,
                        }}
                      >
                        {activeFix.affected_runs &&
                        activeFix.affected_runs.length > 0 ? (
                          activeFix.affected_runs.map((runId) => (
                            <Link
                              key={runId}
                              href={`/backups/${runId}`}
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                background: "rgba(139, 92, 246, 0.1)",
                                color: "var(--iris-500)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                textDecoration: "none",
                                border: "1px solid rgba(139, 92, 246, 0.2)",
                              }}
                            >
                              #{runId}
                            </Link>
                          ))
                        ) : (
                          <span
                            style={{ fontSize: 13, color: "var(--text-muted)" }}
                          >
                            None linked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 12,
                    marginTop: 24,
                  }}
                >
                  {hasToken && (
                    <button
                      type="button"
                      onClick={startEditing}
                      className="m-btn m-btn--secondary"
                      style={{
                        padding: "8px 16px",
                        fontSize: 14,
                        borderColor: "rgba(139, 92, 246, 0.4)",
                        color: "var(--iris-500)",
                      }}
                    >
                      Edit Fix
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveFix(null)}
                    className="m-btn m-btn--secondary"
                    style={{ padding: "8px 16px", fontSize: 14 }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </button>
      )}

      {/* -- Modal dialog: Create Fix ----------------------------------- */}
      {createFixForRun && (
        <button
          type="button"
          aria-label="Close create fix modal overlay backdrop"
          className="m-scrim block w-full border-none p-0 text-left"
          onClick={() => setCreateFixForRun(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setCreateFixForRun(null);
          }}
        >
          <div className="m-dialog" role="dialog" aria-modal="true">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h3
                style={{ fontSize: 18, fontWeight: 600, color: "var(--text)" }}
              >
                Create Resolution Fix for Run #{createFixForRun.id}
              </h3>
              <button
                type="button"
                onClick={() => setCreateFixForRun(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={handleCreateFixSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <label
                  htmlFor="fix-title"
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Title <span style={{ color: "var(--critical-500)" }}>*</span>
                </label>
                <input
                  id="fix-title"
                  type="text"
                  className="m-input"
                  placeholder="e.g., Disable GPG signing for automated commits"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="fix-desc"
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Description
                </label>
                <textarea
                  id="fix-desc"
                  className="m-textarea"
                  placeholder="Explain what caused the failure and how it was resolved..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <label
                    htmlFor="fix-commit"
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Commit Hash (Optional)
                  </label>
                  <input
                    id="fix-commit"
                    type="text"
                    className="m-input"
                    placeholder="e.g., a0252b8"
                    value={formCommit}
                    onChange={(e) => setFormCommit(e.target.value)}
                  />
                </div>

                <div>
                  <label
                    htmlFor="fix-author"
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Author
                  </label>
                  <input
                    id="fix-author"
                    type="text"
                    className="m-input"
                    placeholder="e.g., Shardendu Mishra"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Select Affected Failed Runs
                </span>
                <div
                  style={{
                    maxHeight: 120,
                    overflowY: "auto",
                    background: "rgba(0,0,0,0.15)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                    padding: "8px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {/* Current run is preselected and locked or toggleable */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      style={{ cursor: "not-allowed" }}
                    />
                    <span style={{ fontWeight: 600, color: "var(--iris-500)" }}>
                      Run #{createFixForRun.id} (Current Run)
                    </span>
                  </label>

                  {otherFailedRuns.length > 0 ? (
                    otherFailedRuns.map((run) => (
                      <label
                        key={run.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 14,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formAffected.includes(run.id)}
                          onChange={() => toggleAffectedRun(run.id)}
                        />
                        <span>
                          Run #{run.id} ({formatDate(run.started_at)})
                        </span>
                      </label>
                    ))
                  ) : (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--text-muted)",
                        padding: "4px 0",
                      }}
                    >
                      No other failed runs on this page to select.
                    </div>
                  )}
                </div>
              </div>

              {submitError && (
                <div
                  style={{
                    color: "var(--critical-500)",
                    fontSize: 14,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AlertCircle size={15} /> {submitError}
                </div>
              )}
              {!hasToken && (
                <div
                  style={{
                    color: "var(--critical-500)",
                    fontSize: 14,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                  }}
                >
                  <AlertCircle
                    size={15}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />{" "}
                  <span>
                    You must be logged into the Systems Lab to submit a
                    resolution. (Please login using the sidebar/assistant
                    first).
                  </span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => setCreateFixForRun(null)}
                  className="m-btn m-btn--secondary"
                  style={{ padding: "10px 18px", fontSize: 14 }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="m-btn m-btn--primary"
                  style={{ padding: "10px 18px", fontSize: 14 }}
                  disabled={submitting || !hasToken}
                >
                  {submitting ? "Saving..." : "Save Resolution"}
                </button>
              </div>
            </form>
          </div>
        </button>
      )}

      {/* Modal / overlay helper CSS */}
      <style jsx global>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .modal-content {
          background: var(--surface-raised, #1c1c1f);
          border: 1px solid var(--line, #2a2a2e);
          border-radius: var(--radius-lg, 12px);
          width: 90%;
          max-width: 600px;
          padding: 24px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
          animation: modal-fade-in 0.2s ease-out;
        }

        @keyframes modal-fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
