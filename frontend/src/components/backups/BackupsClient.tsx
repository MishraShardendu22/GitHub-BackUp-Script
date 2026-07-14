"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PaginationBar } from "@/components/analytics/pagination-bar";
import { useAIContext } from "@/components/layout/AIContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDuration } from "@/lib/utils";
import { backupService } from "@/services/backup.service";
import type { BackupFix, BackupRun } from "@/types";

interface InitialData {
  data: BackupRun[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}

export default function BackupsClient({
  initialData,
}: {
  initialData: InitialData;
}) {
  const { data: runs, pagination } = initialData;
  const { isAuthenticated, auth } = useAIContext();

  const [fixesMap, setFixesMap] = useState<Record<number, BackupFix>>({});
  const [loadingFixes, setLoadingFixes] = useState(true);

  // Edit/View Fix Modal State
  const [activeFix, setActiveFix] = useState<BackupFix | null>(null);
  const [isEditingFix, setIsEditingFix] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCommit, setEditCommit] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editAffected, setEditAffected] = useState<number[]>([]);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Create Fix Modal State
  const [createFixForRun, setCreateFixForRun] = useState<BackupRun | null>(
    null,
  );
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCommit, setFormCommit] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const [formAffected, setFormAffected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const otherFailedRuns = runs.filter(
    (r) =>
      r.status === "failed" && r.id !== createFixForRun?.id && !fixesMap[r.id],
  );

  const fetchFixes = async () => {
    try {
      setLoadingFixes(true);
      const res = await backupService.getFixes();
      const newMap: Record<number, BackupFix> = {};
      if (Array.isArray(res)) {
        for (const fix of res) {
          if (Array.isArray(fix.affected_runs)) {
            for (const runId of fix.affected_runs) {
              newMap[runId] = fix;
            }
          }
        }
      }
      setFixesMap(newMap);
    } catch (e) {
      console.error("Failed to load backup fixes", e);
    } finally {
      setLoadingFixes(false);
    }
  };

  useEffect(() => {
    fetchFixes();
  }, [fetchFixes]);

  // Open "View Fix"
  const handleOpenFix = (fix: BackupFix) => {
    setActiveFix(fix);
    setIsEditingFix(false);
    setEditTitle(fix.title);
    setEditDesc(fix.description || "");
    setEditCommit(fix.commit_hash || "");
    setEditAuthor(fix.author || "");
    setEditAffected(fix.affected_runs || []);
    setEditError("");
  };

  const handleUpdateFix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFix) return;
    setSubmittingEdit(true);
    setEditError("");
    try {
      await backupService.updateFix(activeFix.id, {
        title: editTitle,
        description: editDesc,
        commitHash: editCommit,
        author: editAuthor,
        affectedRuns: editAffected,
      });
      await fetchFixes();
      setIsEditingFix(false);
      setActiveFix(null);
    } catch (err: any) {
      setEditError(err.message || "Failed to update fix");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Open "Create Fix"
  const handleOpenCreateFix = (run: BackupRun) => {
    setCreateFixForRun(run);
    setFormTitle("");
    setFormDesc("");
    setFormCommit("");
    setFormAuthor(auth?.username || "");
    setFormAffected([run.id]);
    setSubmitError("");
  };

  const toggleAffectedRun = (id: number, isEdit = false) => {
    if (isEdit) {
      setEditAffected((prev) =>
        prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
      );
    } else {
      setFormAffected((prev) =>
        prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
      );
    }
  };

  const handleCreateFixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFixForRun) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      await backupService.createFix({
        title: formTitle,
        description: formDesc,
        commitHash: formCommit,
        author: formAuthor,
        affectedRuns: formAffected,
      });

      setCreateFixForRun(null);
      await fetchFixes();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to create fix");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col">
            <div className="w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Run #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Repos</TableHead>
                    <TableHead className="text-right">✓ OK</TableHead>
                    <TableHead className="text-right">✗ Failed</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead>Resolution</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const isFailed = run.status === "failed";
                    const hasFix = !!fixesMap[run.id];
                    const fixData = fixesMap[run.id];

                    return (
                      <TableRow key={run.id} className="group">
                        <TableCell className="font-medium">#{run.id}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              run.status === "completed"
                                ? "default"
                                : run.status === "running"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className={
                              run.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20"
                                : ""
                            }
                          >
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDate(run.started_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDuration(run.duration_ms)}
                        </TableCell>
                        <TableCell className="text-right">
                          {run.total_repos}
                        </TableCell>
                        <TableCell className="text-right text-emerald-500 font-medium">
                          {run.successful}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${run.failed > 0 ? "text-destructive" : ""}`}
                        >
                          {run.failed}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {run.skipped}
                        </TableCell>
                        <TableCell>
                          {isFailed ? (
                            loadingFixes ? (
                              <div className="flex flex-col gap-1 w-24">
                                <div className="h-2 bg-muted rounded w-full animate-pulse"></div>
                                <div className="h-2 bg-muted rounded w-2/3 animate-pulse"></div>
                              </div>
                            ) : hasFix ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenFix(fixData)}
                                className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/15 w-[140px] justify-start"
                              >
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  View Resolution
                                </span>
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenCreateFix(run)}
                                className="h-7 text-xs gap-1.5 border-primary/30 text-primary bg-primary/5 hover:bg-primary/15 w-[140px] justify-start"
                                disabled={!isAuthenticated}
                                title={
                                  !isAuthenticated
                                    ? "Login via sidebar to create fix"
                                    : ""
                                }
                              >
                                <Wrench className="h-3 w-3 shrink-0" />
                                <span className="truncate">Resolve Issue</span>
                              </Button>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Link href={`/backups/${run.id}`}>
                              Details <ArrowRight className="h-4 w-4 ml-2" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="p-4 border-t border-border">
              <PaginationBar
                page={pagination.page}
                totalPages={pagination.total_pages}
                pageSize={pagination.limit}
                totalItems={pagination.total_items}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal dialog: View / Edit Fix Details */}
      <Dialog
        open={!!activeFix}
        onOpenChange={(open) => !open && setActiveFix(null)}
      >
        <DialogContent className="sm:max-w-[600px] gap-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-4">
              <span className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                {isEditingFix ? "Edit Resolution" : "Resolution Details"}
              </span>
              {activeFix && !isEditingFix && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingFix(true)}
                  disabled={!isAuthenticated}
                >
                  Edit
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              {isEditingFix
                ? "Update the details for this resolution."
                : "Details of the fix applied to this backup run."}
            </DialogDescription>
          </DialogHeader>

          {!isEditingFix && activeFix ? (
            <div className="flex flex-col gap-6">
              <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                <h4 className="font-semibold text-lg mb-2 text-foreground">
                  {activeFix.title}
                </h4>
                {activeFix.description ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {activeFix.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No description provided.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 p-3 bg-card border rounded-lg">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Commit Hash
                  </span>
                  {activeFix.commit_hash ? (
                    <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-0.5 rounded w-fit">
                      {activeFix.commit_hash}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 p-3 bg-card border rounded-lg">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Author
                  </span>
                  <span className="text-sm font-medium">
                    {activeFix.author || "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 p-3 bg-card border rounded-lg col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Created At
                  </span>
                  <span className="text-sm">
                    {formatDate(activeFix.created_at)}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 p-3 bg-card border rounded-lg col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Affected Runs
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeFix.affected_runs?.map((runId) => (
                      <Badge
                        key={runId}
                        variant="secondary"
                        className="px-1.5 py-0"
                      >
                        #{runId}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            activeFix && (
              <form onSubmit={handleUpdateFix} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-desc">Description</Label>
                  <Textarea
                    id="edit-desc"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="h-24 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-commit">Commit Hash</Label>
                    <Input
                      id="edit-commit"
                      value={editCommit}
                      onChange={(e) => setEditCommit(e.target.value)}
                      placeholder="e.g. a1b2c3d"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-author">Author</Label>
                    <Input
                      id="edit-author"
                      value={editAuthor}
                      onChange={(e) => setEditAuthor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Affected Failed Runs</Label>
                  <ScrollArea className="h-32 rounded-md border p-3">
                    <div className="flex flex-col gap-3">
                      {runs
                        .filter((r) => r.status === "failed")
                        .map((run) => {
                          const _isOriginalRun =
                            activeFix.affected_runs?.includes(run.id);
                          const isChecked = editAffected.includes(run.id);
                          const isOtherFix =
                            !!fixesMap[run.id] &&
                            fixesMap[run.id].id !== activeFix.id;

                          if (isOtherFix && !isChecked) return null; // hide runs associated with other fixes

                          return (
                            <div
                              key={run.id}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`edit-run-${run.id}`}
                                checked={isChecked}
                                onCheckedChange={() =>
                                  toggleAffectedRun(run.id, true)
                                }
                              />
                              <label
                                htmlFor={`edit-run-${run.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                Run #{run.id}{" "}
                                <span className="text-muted-foreground ml-1 font-normal">
                                  ({formatDate(run.started_at)})
                                </span>
                              </label>
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                </div>

                {editError && (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md flex items-center gap-2 border border-destructive/20">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {editError}
                  </div>
                )}

                <DialogFooter className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingFix(false)}
                    disabled={submittingEdit}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submittingEdit}>
                    {submittingEdit && (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Modal dialog: Create Fix */}
      <Dialog
        open={!!createFixForRun}
        onOpenChange={(open) => !open && setCreateFixForRun(null)}
      >
        <DialogContent className="sm:max-w-[600px] gap-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Create Resolution
            </DialogTitle>
            <DialogDescription>
              Record the fix for Run #{createFixForRun?.id} so the AI agent
              learns from it.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleCreateFixSubmit}
            className="flex flex-col gap-4"
          >
            <div className="space-y-2">
              <Label htmlFor="create-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Disable GPG signing for automated commits"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-desc">Description</Label>
              <Textarea
                id="create-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Explain what caused the failure and how it was resolved..."
                className="h-24 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-commit">Commit Hash (Optional)</Label>
                <Input
                  id="create-commit"
                  value={formCommit}
                  onChange={(e) => setFormCommit(e.target.value)}
                  placeholder="e.g. a1b2c3d"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-author">Author</Label>
                <Input
                  id="create-author"
                  value={formAuthor}
                  onChange={(e) => setFormAuthor(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Affected Failed Runs</Label>
              <ScrollArea className="h-32 rounded-md border p-3 bg-muted/10">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="current-run" checked disabled />
                    <label
                      htmlFor="current-run"
                      className="text-sm font-medium leading-none text-primary cursor-not-allowed"
                    >
                      Run #{createFixForRun?.id} (Current Run)
                    </label>
                  </div>

                  {otherFailedRuns.map((run) => (
                    <div key={run.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`create-run-${run.id}`}
                        checked={formAffected.includes(run.id)}
                        onCheckedChange={() => toggleAffectedRun(run.id)}
                      />
                      <label
                        htmlFor={`create-run-${run.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Run #{run.id}{" "}
                        <span className="text-muted-foreground ml-1 font-normal">
                          ({formatDate(run.started_at)})
                        </span>
                      </label>
                    </div>
                  ))}

                  {otherFailedRuns.length === 0 && (
                    <div className="text-xs text-muted-foreground italic ml-6">
                      No other failed runs on this page to select.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {submitError && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md flex items-center gap-2 border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {submitError}
              </div>
            )}

            {!isAuthenticated && (
              <div className="p-3 text-sm text-amber-600 bg-amber-500/10 rounded-md flex items-start gap-2 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  You must be logged into the AI Observatory to submit a
                  resolution. (Please login using the sidebar/assistant first).
                </span>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateFixForRun(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !isAuthenticated}>
                {submitting && (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Resolution
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
