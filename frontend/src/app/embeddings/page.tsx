"use client";

import { useCallback, useEffect, useState } from "react";
import { useAIContext } from "@/components/layout/AIContext";
import { ModelSelector } from "@/components/ai/ModelSelector";
import { searchService } from "@/services/search.service";
import type { EmbeddingModel, RerankModel, GenerationStatus } from "@/services/search.service";
import { AlertCircle, Database } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function EmbeddingsPage() {
  const { auth, isAuthenticated } = useAIContext();
  const [embeddingModels, setEmbeddingModels] = useState<EmbeddingModel[]>([]);
  const [rerankModels, setRerankModels] = useState<RerankModel[]>([]);
  const [selectedEmbedding, setSelectedEmbedding] = useState<EmbeddingModel | null>(null);
  const [selectedRerank, setSelectedRerank] = useState<RerankModel | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<GenerationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

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
      if (em.length > 0) setSelectedEmbedding(em[0]);
      if (rm.length > 0) setSelectedRerank(rm[0]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch models";
      setModelsError(message);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated || !auth?.token) return;
    try {
      setLoadingStatus(true);
      setStatusError(null);
      const status = await searchService.getGenerationStatus(auth.token);
      setGenStatus(status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch generation status";
      setStatusError(message);
    } finally {
      setLoadingStatus(false);
    }
  }, [isAuthenticated, auth?.token]);

  useEffect(() => { fetchModels(); }, [fetchModels]);
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleStartGeneration = async () => {
    if (!selectedEmbedding || !isAuthenticated || !auth?.token) return;
    try {
      await searchService.startGeneration(auth.token, selectedEmbedding.id);
      fetchStatus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start generation";
      setStatusError(message);
    }
  };

  const handleProcessBatch = async () => {
    if (!genStatus || !isAuthenticated || !auth?.token) return;
    try {
      await searchService.processBatch(auth.token, genStatus.id);
      fetchStatus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process batch";
      setStatusError(message);
    }
  };

  const handleActivateGeneration = async () => {
    if (!genStatus || !isAuthenticated || !auth?.token) return;
    try {
      await searchService.activateGeneration(auth.token, genStatus.id);
      fetchStatus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to activate generation";
      setStatusError(message);
    }
  };

  return (
    <div className="page">
      {/* Hero */}
      <section
        className="card section-card reveal"
        style={{ borderTop: "2px solid var(--accent)", padding: "40px 48px", marginBottom: 32 }}
      >
        <div className="page-head">
          <div>
            <div className="page-kicker">Vector Index &amp; Embeddings</div>
            <h1 className="page-title">
              Embedding
              <br />
              <em>Configuration</em>
            </h1>
            <p className="page-subtitle">
              Configure embedding models, manage vector index generations, and monitor background chunking jobs.
            </p>
          </div>
        </div>
      </section>

      {/* Model Selection Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div className="card">
          <SectionHeader
            title="Embedding Model"
            subtitle="Select model for dense vector generation"
          />
          <div style={{ marginTop: 16 }}>
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
          {selectedEmbedding && (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <span className="badge">{selectedEmbedding.dimensions} dims</span>
              <span className="badge">{selectedEmbedding.provider}</span>
            </div>
          )}
        </div>

        <div className="card">
          <SectionHeader
            title="Reranking Model"
            subtitle="Select cross-encoder model for result re-scoring"
          />
          <div style={{ marginTop: 16 }}>
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
          {selectedRerank && (
            <div style={{ marginTop: 12 }}>
              <span className="badge">{selectedRerank.provider}</span>
            </div>
          )}
        </div>
      </div>

      {/* Vector Index & Queue */}
      <section className="card" style={{ marginBottom: 32 }}>
        <SectionHeader
          title="Vector Index & Background Queue"
          subtitle="Resumable background job processing with sliding-window chunking"
        />

        {!isAuthenticated ? (
          <EmptyState
            message="Authentication Required"
            description="Please log in to view and manage generation status."
            icon={<AlertCircle size={24} />}
          />
        ) : loadingStatus ? (
          <LoadingState message="Fetching generation status..." />
        ) : statusError ? (
          <ErrorState message={statusError} retry={fetchStatus} />
        ) : genStatus ? (
          <div>
            <div className="stat-grid" style={{ marginTop: 24, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-label">Index Status</div>
                <div className="stat-value" style={{ fontSize: "28px" }}>
                  <StatusBadge status={genStatus.status} />
                </div>
                <div className="stat-sub">Generation #{genStatus.id}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Processed Chunks</div>
                <div className="stat-value" style={{ fontSize: "28px" }}>
                  {genStatus.processed_items} / {genStatus.total_items}
                </div>
                <div className="stat-sub">{genStatus.failed_items} failed</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active Model</div>
                <div className="stat-value" style={{ fontSize: "16px", wordBreak: "break-all" }}>
                  {genStatus.model_id}
                </div>
                <div className="stat-sub">{genStatus.dimensions} dimensions</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Job Counts</div>
                <div className="stat-value" style={{ fontSize: "18px" }}>
                  {Object.entries(genStatus.job_counts || {}).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)" }}>{k}: </span>
                      <strong>{String(v)}</strong>
                    </div>
                  ))}
                </div>
                <div className="stat-sub">by status</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={handleStartGeneration}
                disabled={!selectedEmbedding}
              >
                Start New Generation
              </button>
              <button
                className="btn btn-outline"
                onClick={handleProcessBatch}
                disabled={genStatus.status !== "BUILDING"}
              >
                Process Batch
              </button>
              <button
                className="btn btn-outline"
                onClick={handleActivateGeneration}
                disabled={genStatus.status !== "READY"}
              >
                Activate Generation
              </button>
              <button className="btn btn-outline" onClick={fetchStatus}>
                Refresh Status
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <EmptyState
              message="No Active Generation"
              description="Start a new generation process to scan and chunk source tables into the vector index."
              icon={<Database size={24} />}
            />
            <button
              className="btn btn-primary"
              onClick={handleStartGeneration}
              disabled={!selectedEmbedding}
            >
              Start Generation
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
