"use client";

import {
  AlertCircle,
  CheckCircle2,
  Database,
  FastForward,
  Layers,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ModelSelector } from "@/components/ai/ModelSelector";
import { useAIContext } from "@/components/layout/AIContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  EmbeddingModel,
  GenerationStatus,
  RerankModel,
} from "@/services/search.service";
import { searchService } from "@/services/search.service";

interface BatchLog {
  id: string;
  timestamp: string;
  type: "info" | "success" | "error";
  text: string;
}

export default function EmbeddingsPage() {
  const { auth, isAuthenticated } = useAIContext();
  const [embeddingModels, setEmbeddingModels] = useState<EmbeddingModel[]>([]);
  const [rerankModels, setRerankModels] = useState<RerankModel[]>([]);
  const [selectedEmbedding, setSelectedEmbedding] =
    useState<EmbeddingModel | null>(null);
  const [selectedRerank, setSelectedRerank] = useState<RerankModel | null>(
    null,
  );
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [genStatus, setGenStatus] = useState<GenerationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Auto-processing & manual batch state
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [isProcessingSingle, setIsProcessingSingle] = useState(false);
  const [isStartingGen, setIsStartingGen] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [batchSize, setBatchSize] = useState<number>(50);
  const [logs, setLogs] = useState<BatchLog[]>([]);

  const autoProcessRef = useRef(false);
  autoProcessRef.current = isAutoProcessing;

  const addLog = useCallback(
    (text: string, type: "info" | "success" | "error" = "info") => {
      const timeStr = new Date().toLocaleTimeString();
      const newLog: BatchLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: timeStr,
        text,
        type,
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
    },
    [],
  );

  const fetchModels = useCallback(async () => {
    try {
      setLoadingModels(true);
      setModelsError(null);
      const [em, rm] = await Promise.all([
        searchService.fetchEmbeddingModels(),
        searchService.fetchRerankModels(),
      ]);
      setEmbeddingModels(em);
      setRerankModels(rm);
      if (em.length > 0 && !selectedEmbedding) setSelectedEmbedding(em[0]);
      if (rm.length > 0 && !selectedRerank) setSelectedRerank(rm[0]);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch models";
      setModelsError(message);
    } finally {
      setLoadingModels(false);
    }
  }, [selectedEmbedding, selectedRerank]);

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated || !auth?.token) return;
    try {
      setLoadingStatus(true);
      setStatusError(null);
      const status = await searchService.getGenerationStatus(auth.token);
      setGenStatus(status);

      // Sync model selector with active/building generation target model to avoid mismatched info
      if (status?.model_id && embeddingModels.length > 0) {
        const matching = embeddingModels.find((m) => m.id === status.model_id);
        if (matching) {
          setSelectedEmbedding(matching);
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to fetch generation status";
      setStatusError(message);
    } finally {
      setLoadingStatus(false);
    }
  }, [isAuthenticated, auth?.token, embeddingModels]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchStatus();
    addLog("Generation status updated from server.", "info");
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Synchronize matching model if models load after status
  useEffect(() => {
    if (genStatus?.model_id && embeddingModels.length > 0) {
      const matching = embeddingModels.find((m) => m.id === genStatus.model_id);
      if (matching && selectedEmbedding?.id !== matching.id) {
        setSelectedEmbedding(matching);
      }
    }
  }, [genStatus?.model_id, embeddingModels, selectedEmbedding?.id]);

  // Periodic polling when building
  useEffect(() => {
    if (!isAuthenticated || !genStatus || genStatus.status !== "BUILDING")
      return;
    const interval = setInterval(() => {
      if (!autoProcessRef.current) {
        fetchStatus();
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [isAuthenticated, genStatus, fetchStatus]);

  const handleStartGeneration = async () => {
    if (!selectedEmbedding || !isAuthenticated || !auth?.token) return;
    try {
      setIsStartingGen(true);
      setStatusError(null);
      addLog(
        `Starting new generation for model: ${selectedEmbedding.id}...`,
        "info",
      );
      const res = (await searchService.startGeneration(
        auth.token,
        selectedEmbedding.id,
      )) as Record<string, unknown>;
      addLog(
        `Generation #${res?.generation_id || "new"} created. Enqueued ${res?.total_enqueued || 0} source records.`,
        "success",
      );
      await fetchStatus();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start generation";
      setStatusError(message);
      addLog(`Failed to start generation: ${message}`, "error");
    } finally {
      setIsStartingGen(false);
    }
  };

  const processOneBatch = useCallback(async () => {
    if (!genStatus || !isAuthenticated || !auth?.token) return false;
    try {
      const res = (await searchService.processBatch(
        auth.token,
        genStatus.id,
        batchSize,
      )) as {
        processed: number;
        succeeded: number;
        failed: number;
        message?: string;
      };

      if (res.processed === 0) {
        addLog(
          res.message || "All pending chunks for this generation are completed",
          "success",
        );
        await fetchStatus();
        return false;
      }

      addLog(
        `Batch processed: ${res.succeeded} vectors generated successfully (failed: ${res.failed})`,
        res.failed > 0 ? "error" : "success",
      );
      await fetchStatus();
      return res.processed > 0;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Batch processing failed";
      setStatusError(message);
      addLog(`Error processing batch: ${message}`, "error");
      return false;
    }
  }, [genStatus, isAuthenticated, auth?.token, batchSize, addLog, fetchStatus]);

  const handleProcessSingleBatch = async () => {
    setIsProcessingSingle(true);
    await processOneBatch();
    setIsProcessingSingle(false);
  };

  // Continuous auto-processor loop
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const runLoop = async () => {
      if (!isAutoProcessing) return;
      const hasMore = await processOneBatch();
      if (!hasMore || !autoProcessRef.current) {
        setIsAutoProcessing(false);
        addLog("Auto-processing loop completed.", "info");
      } else {
        timeoutId = setTimeout(runLoop, 500);
      }
    };

    if (isAutoProcessing) {
      runLoop();
    }

    return () => clearTimeout(timeoutId);
  }, [isAutoProcessing, processOneBatch, addLog]);

  const toggleAutoProcess = () => {
    if (!isAutoProcessing) {
      addLog(
        `Starting auto-builder with batch size of ${batchSize}...`,
        "info",
      );
      setIsAutoProcessing(true);
    } else {
      addLog("Pausing auto-builder pipeline...", "info");
      setIsAutoProcessing(false);
    }
  };

  const handleActivateGeneration = async () => {
    if (!genStatus || !isAuthenticated || !auth?.token) return;
    try {
      setIsActivating(true);
      setStatusError(null);
      await searchService.activateGeneration(auth.token, genStatus.id);
      addLog(
        `Generation #${genStatus.id} activated! Now serving all production searches.`,
        "success",
      );
      await fetchStatus();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to activate generation";
      setStatusError(message);
      addLog(`Activation failed: ${message}`, "error");
    } finally {
      setIsActivating(false);
    }
  };

  const isBuilding = genStatus?.status === "BUILDING";
  const isActive = genStatus?.status === "ACTIVE";
  const totalItems = genStatus?.total_items || 0;
  const processedItems = genStatus?.processed_items || 0;
  const pendingItems = Math.max(0, totalItems - processedItems);
  const isReadyToActivate =
    isBuilding && totalItems > 0 && processedItems >= totalItems;
  const progressPercent =
    totalItems > 0
      ? Math.min(100, Math.round((processedItems / totalItems) * 100))
      : 0;

  return (
    <div className="page">
      {/* Compact Top Header */}
      <section
        className="card section-card reveal"
        style={{
          borderTop: "2px solid var(--accent)",
          padding: "16px 24px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div className="page-kicker" style={{ marginBottom: 2 }}>
            Vector Index &amp; Dense Embeddings
          </div>
          <h1 className="page-title" style={{ fontSize: "22px", margin: 0 }}>
            Embedding <em>Management &amp; Indexer</em>
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {genStatus && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface)",
                padding: "6px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Current Index:
              </span>
              <StatusBadge status={genStatus.status} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                #{genStatus.id}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 2 Main Panels Side-by-Side */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: 18,
          alignItems: "start",
          marginBottom: 18,
        }}
      >
        {/* Panel 1: Model Selection & AI Provider */}
        <section className="card" style={{ padding: "22px 24px" }}>
          <SectionHeader
            title="Model Selection"
            subtitle="Configure dense vector embedding and cross-encoder reranker"
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginTop: 14,
            }}
          >
            {/* Dense Embedding Model */}
            <div
              style={{
                background: "var(--surface)",
                padding: "14px 18px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Layers size={14} style={{ color: "var(--accent)" }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    Dense Embedding Model
                  </span>
                </div>
                {selectedEmbedding && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className="badge" style={{ fontSize: 11 }}>
                      {selectedEmbedding.dimensions} dims
                    </span>
                    <span className="badge" style={{ fontSize: 11 }}>
                      {selectedEmbedding.provider}
                    </span>
                  </div>
                )}
              </div>

              <ModelSelector
                models={embeddingModels}
                selectedModel={selectedEmbedding?.id || ""}
                onSelectModel={(modelId) => {
                  const found = embeddingModels.find((m) => m.id === modelId);
                  if (found) setSelectedEmbedding(found);
                }}
                loading={loadingModels}
                error={modelsError}
                onRefresh={fetchModels}
              />
            </div>

            {/* Cross-Encoder Reranker */}
            <div
              style={{
                background: "var(--surface)",
                padding: "14px 18px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={14} style={{ color: "var(--accent)" }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    Cross-Encoder Reranker
                  </span>
                </div>
                {selectedRerank && (
                  <span className="badge" style={{ fontSize: 11 }}>
                    {selectedRerank.provider}
                  </span>
                )}
              </div>

              <ModelSelector
                models={rerankModels}
                selectedModel={selectedRerank?.id || ""}
                onSelectModel={(modelId) => {
                  const found = rerankModels.find((m) => m.id === modelId);
                  if (found) setSelectedRerank(found);
                }}
                loading={loadingModels}
                error={modelsError}
                onRefresh={fetchModels}
              />
            </div>

            {/* Start New Generation Action Box */}
            <div
              style={{
                background: "rgba(235, 160, 65, 0.04)",
                border: "1px dashed var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  Initialize New Generation
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Scans source tables &amp; enqueues text chunks for selected
                  model
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartGeneration}
                disabled={
                  !selectedEmbedding || isStartingGen || isAutoProcessing
                }
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                {isStartingGen ? (
                  <>
                    <Loader2 size={13} className="spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    Start New Gen
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Panel 2: Vector Index & Interactive Workflow */}
        <section className="card" style={{ padding: "22px 24px" }}>
          <SectionHeader
            title="Vector Index & Batch Pipeline"
            subtitle="Real-time chunking progress, batch controls, and live worker logs"
          />

          {!isAuthenticated ? (
            <div style={{ padding: "20px 0" }}>
              <EmptyState
                message="Authentication Required"
                description="Please log in to view and manage generation status."
                icon={<AlertCircle size={22} />}
              />
            </div>
          ) : loadingStatus && !genStatus ? (
            <div style={{ padding: "24px 0" }}>
              <LoadingState message="Connecting to vector registry..." />
            </div>
          ) : statusError && !genStatus ? (
            <div style={{ padding: "20px 0" }}>
              <ErrorState message={statusError} retry={fetchStatus} />
            </div>
          ) : genStatus ? (
            <div style={{ marginTop: 14 }}>
              {/* 3-Step Pipeline Visualizer */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {/* Step 1: Enqueue */}
                <div
                  style={{
                    background: "var(--surface)",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    1. Enqueued
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text)",
                      marginTop: 2,
                    }}
                  >
                    {totalItems} Chunks
                  </div>
                </div>

                {/* Step 2: Processing */}
                <div
                  style={{
                    background: isBuilding
                      ? "rgba(235, 160, 65, 0.08)"
                      : "var(--surface)",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: isBuilding
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: isBuilding ? "var(--accent)" : "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    2. Embedding
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text)",
                      marginTop: 2,
                    }}
                  >
                    {processedItems} / {totalItems} ({progressPercent}%)
                  </div>
                </div>

                {/* Step 3: Activation */}
                <div
                  style={{
                    background: isActive
                      ? "rgba(46, 204, 113, 0.08)"
                      : "var(--surface)",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: isActive
                      ? "1px solid var(--success, #2ecc71)"
                      : "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: isActive
                        ? "var(--success, #2ecc71)"
                        : "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    3. Production
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text)",
                      marginTop: 2,
                    }}
                  >
                    {isActive
                      ? "ACTIVE"
                      : isReadyToActivate
                        ? "Ready"
                        : "Pending"}
                  </div>
                </div>
              </div>

              {/* Progress Bar with Live Pulse */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {isAutoProcessing && (
                      <Loader2
                        size={12}
                        className="spin"
                        style={{ color: "var(--accent)" }}
                      />
                    )}
                    {isBuilding
                      ? isAutoProcessing
                        ? "Embedding vectors live via OpenRouter..."
                        : `${pendingItems} chunks remaining`
                      : isActive
                        ? "Serving hybrid search queries"
                        : "All chunks embedded — ready to activate"}
                  </span>
                  <strong style={{ color: "var(--accent)" }}>
                    {progressPercent}% Complete
                  </strong>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    background: "var(--surface2)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      height: "100%",
                      background: isActive
                        ? "var(--success, #2ecc71)"
                        : "var(--accent)",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>

              {/* Target Model Tag & Details */}
              <div
                style={{
                  background: "var(--surface)",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  marginBottom: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    Target Model:
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--accent)",
                    }}
                  >
                    {genStatus.model_id}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span className="badge" style={{ fontSize: 11 }}>
                    {genStatus.dimensions} Dims
                  </span>
                  <span className="badge" style={{ fontSize: 11 }}>
                    Status: {genStatus.status}
                  </span>
                </div>
              </div>

              {/* Action Controls Toolbar with Clean Segments & Spacing */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {/* Main Auto-Process or Activate Button */}
                {isReadyToActivate ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleActivateGeneration}
                    disabled={isActivating}
                    style={{
                      padding: "8px 18px",
                      fontSize: 13,
                      background: "var(--success, #2ecc71)",
                      borderColor: "var(--success, #2ecc71)",
                    }}
                  >
                    {isActivating ? (
                      <>
                        <Loader2 size={14} className="spin" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        Activate Generation #{genStatus.id}
                      </>
                    )}
                  </button>
                ) : isBuilding ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={toggleAutoProcess}
                      style={{ padding: "8px 16px", fontSize: 13 }}
                    >
                      {isAutoProcessing ? (
                        <>
                          <Pause size={14} />
                          Pause Pipeline
                        </>
                      ) : (
                        <>
                          <Zap size={14} />
                          Auto-Build Index ({pendingItems})
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleProcessSingleBatch}
                      disabled={isAutoProcessing || isProcessingSingle}
                      style={{ padding: "8px 14px", fontSize: 12 }}
                    >
                      {isProcessingSingle ? (
                        <>
                          <Loader2 size={13} className="spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FastForward size={13} />
                          Process +{batchSize}
                        </>
                      )}
                    </button>

                    {/* Clean segmented batch selector */}
                    <div
                      style={{
                        display: "inline-flex",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        padding: 2,
                      }}
                    >
                      {[25, 50, 100].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setBatchSize(size)}
                          style={{
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: "calc(var(--radius-md) - 2px)",
                            background:
                              batchSize === size
                                ? "var(--accent)"
                                : "transparent",
                            color:
                              batchSize === size ? "#000" : "var(--text-muted)",
                            border: "none",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {/* Working Refresh Button with Live Animation */}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginLeft: "auto",
                  }}
                  title="Refresh generation status from database"
                >
                  <RefreshCw size={13} className={isRefreshing ? "spin" : ""} />
                  {isRefreshing ? "Updating..." : "Refresh"}
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                padding: "24px 0",
              }}
            >
              <EmptyState
                message="No Generation Initialized"
                description="Select an embedding model on the left and click 'Start New Gen' to begin."
                icon={<Database size={24} />}
              />
            </div>
          )}
        </section>
      </div>

      {/* Real-time Activity Log & Console Feed */}
      <section className="card" style={{ padding: "16px 20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Terminal size={14} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              Live Vector Worker Console
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {logs.length > 0
              ? `${logs.length} live events`
              : "Connected to worker stream"}
          </span>
        </div>

        <div
          style={{
            background: "#0d0b0a",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            maxHeight: 180,
            overflowY: "auto",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11.5,
            lineHeight: 1.6,
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: "rgba(255, 255, 255, 0.4)" }}>
              [{new Date().toLocaleTimeString()}] Ready. Generation #
              {genStatus?.id ?? "--"} (
              {genStatus
                ? `${genStatus.processed_items}/${genStatus.total_items} chunks, status: ${genStatus.status}`
                : "idle"}
              ). Click &quot;Auto-Build Index&quot; or &quot;Process&quot; to
              continue.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                style={{
                  color:
                    log.type === "success"
                      ? "var(--success, #2ecc71)"
                      : log.type === "error"
                        ? "var(--danger, #e74c3c)"
                        : "rgba(255, 255, 255, 0.7)",
                }}
              >
                <span
                  style={{
                    color: "rgba(255, 255, 255, 0.3)",
                    marginRight: 8,
                  }}
                >
                  [{log.timestamp}]
                </span>
                {log.text}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
