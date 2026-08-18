"use client";

import { useEffect, useState } from "react";
import { useAIContext } from "@/components/layout/AIContext";
import { searchService } from "@/services/search.service";
import type { RerankModel, SearchResult } from "@/services/search.service";
import { Search, Database, Layers, Filter, Sliders, GitMerge } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHeader } from "@/components/ui/SectionHeader";

const SOURCE_TYPES = [
  { id: "chat_message", label: "Chat Messages" },
  { id: "execution_log", label: "Execution Logs" },
  { id: "investigation", label: "Investigations" },
  { id: "backup_result", label: "Backup Results" },
  { id: "backup_fix", label: "Backup Fixes" },
];

export default function SearchPlaygroundPage() {
  const { auth, isAuthenticated } = useAIContext();

  const [rerankModels, setRerankModels] = useState<RerankModel[]>([]);
  const [selectedRerank, setSelectedRerank] = useState<RerankModel | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);

  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<"hybrid" | "fts" | "semantic">("hybrid");
  const [ftsWeight, setFtsWeight] = useState(0.3);
  const [semanticWeight, setSemanticWeight] = useState(0.7);
  const [enableRerank, setEnableRerank] = useState(true);

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    searchService.fetchRerankModels().then((rm) => {
      setRerankModels(rm);
      if (rm.length > 0) setSelectedRerank(rm[0]);
      setLoadingModels(false);
    }).catch(() => setLoadingModels(false));
  }, []);

  const handleSearch = async () => {
    if (!query.trim() || !isAuthenticated || !auth?.token) return;
    try {
      setIsSearching(true);
      setSearchError(null);

      let effectiveFtsWeight = ftsWeight;
      let effectiveSemanticWeight = semanticWeight;
      if (searchMode === "fts") { effectiveFtsWeight = 1.0; effectiveSemanticWeight = 0.0; }
      else if (searchMode === "semantic") { effectiveFtsWeight = 0.0; effectiveSemanticWeight = 1.0; }

      const res = await searchService.search(auth.token, {
        query,
        source_types: selectedTypes.length > 0 ? selectedTypes : undefined,
        limit: 10,
        fts_weight: effectiveFtsWeight,
        semantic_weight: effectiveSemanticWeight,
        rerank_model_id: enableRerank ? selectedRerank?.id : undefined,
      });
      setSearchResults(res.results);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Search failed";
      setSearchError(message);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSourceType = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
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
            <div className="page-kicker">Experiments &amp; Retrieval Engine</div>
            <h1 className="page-title">
              Search
              <br />
              <em>Playground</em>
            </h1>
            <p className="page-subtitle">
              Benchmark Full-Text Search (FTS), Semantic Vector Search, Hybrid Rank Fusion (RRF), and Cross-Encoder Reranking.
            </p>
          </div>
        </div>
      </section>

      {/* Search Engine */}
      <section className="card">
        <SectionHeader
          title="Search Engine Benchmark"
          subtitle="Compare search relevance across FTS, Semantic Vector, Hybrid RRF, and Reranking"
        />

        {/* Search Mode Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <button
            className={`btn ${searchMode === "hybrid" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setSearchMode("hybrid")}
          >
            <GitMerge size={15} />
            Hybrid Search (FTS + Vector + RRF)
          </button>
          <button
            className={`btn ${searchMode === "fts" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setSearchMode("fts")}
          >
            <Database size={15} />
            Full-Text Search (FTS)
          </button>
          <button
            className={`btn ${searchMode === "semantic" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setSearchMode("semantic")}
          >
            <Layers size={15} />
            Semantic Search (Vector)
          </button>
        </div>

        {/* RRF Weight Controls */}
        {searchMode === "hybrid" && (
          <div
            style={{
              background: "var(--surface)",
              padding: "20px 24px",
              borderRadius: "var(--radius-md)",
              marginBottom: 24,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Sliders size={15} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                RRF Fusion Weight Distribution
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
                  FTS Weight: <strong style={{ color: "var(--text)" }}>{ftsWeight.toFixed(2)}</strong>
                </label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={ftsWeight}
                  onChange={(e) => setFtsWeight(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--accent)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
                  Semantic Weight: <strong style={{ color: "var(--text)" }}>{semanticWeight.toFixed(2)}</strong>
                </label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={semanticWeight}
                  onChange={(e) => setSemanticWeight(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--accent)" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Reranking Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <input
            type="checkbox"
            id="rerank-toggle"
            checked={enableRerank}
            onChange={(e) => setEnableRerank(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent)" }}
          />
          <label htmlFor="rerank-toggle" style={{ fontSize: 13, cursor: "pointer", color: "var(--text)" }}>
            Enable Cross-Encoder Reranking
            {selectedRerank && (
              <> with <strong style={{ color: "var(--accent)" }}>{selectedRerank.id}</strong></>
            )}
          </label>
          {!loadingModels && rerankModels.length > 1 && (
            <select
              value={selectedRerank?.id || ""}
              onChange={(e) => {
                const found = rerankModels.find((m) => m.id === e.target.value);
                if (found) setSelectedRerank(found);
              }}
              style={{
                marginLeft: 8,
                fontSize: 12,
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              {rerankModels.map((m) => (
                <option key={m.id} value={m.id}>{m.id}</option>
              ))}
            </select>
          )}
        </div>

        {/* Query Input */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <input
            type="text"
            className="input"
            style={{ flex: 1 }}
            placeholder="Enter query — e.g. backup connection error, failed repositories, rate limit..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={isSearching || !isAuthenticated}
          />
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={isSearching || !isAuthenticated || !query.trim()}
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Source Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 32 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Filter size={13} /> Filter:
          </span>
          {SOURCE_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => toggleSourceType(type.id)}
              className={`badge ${selectedTypes.includes(type.id) ? "badge-running" : ""}`}
              style={{
                cursor: "pointer",
                background: selectedTypes.includes(type.id) ? "var(--accent-bg)" : "var(--surface)",
              }}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div>
          {searchError ? (
            <ErrorState message={searchError} />
          ) : isSearching ? (
            <LoadingState message="Executing query and scoring results..." />
          ) : searchResults.length > 0 ? (
            searchResults.map((result) => (
              <div
                key={`${result.source_type}-${result.id}`}
                className="card-flat"
                style={{ marginBottom: 12 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="badge badge-running">{result.source_type}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>ID: {result.source_id}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                      Score: {result.score.toFixed(4)}
                    </span>
                    {result.reranked && (
                      <span className="badge badge-success" style={{ fontSize: 10 }}>Reranked</span>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, margin: 0 }}>
                  {result.content}
                </p>
              </div>
            ))
          ) : query && !isSearching ? (
            <EmptyState
              message="No Results Found"
              description="Try adjusting your query, mode, or source type filters."
              icon={<Search size={24} />}
            />
          ) : !isAuthenticated ? (
            <EmptyState
              message="Login Required"
              description="Please log in to run search queries."
              icon={<Search size={24} />}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
