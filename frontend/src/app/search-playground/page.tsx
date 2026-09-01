"use client";

import {
  Database,
  Filter,
  GitMerge,
  Layers,
  Search,
  Sliders,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MessageContentRenderer } from "@/components/ai/MessageContentRenderer";
import { useAIContext } from "@/components/layout/AIContext";
import { Dropdown } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import type { RerankModel, SearchResult } from "@/services/search.service";
import { searchService } from "@/services/search.service";

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
  const [selectedRerank, setSelectedRerank] = useState<RerankModel | null>(
    null,
  );
  const [loadingModels, setLoadingModels] = useState(true);

  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<"hybrid" | "fts" | "semantic">(
    "hybrid",
  );
  const [ftsWeight, setFtsWeight] = useState(0.3);
  const [semanticWeight, setSemanticWeight] = useState(0.7);
  const [enableRerank, setEnableRerank] = useState(true);

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    searchService
      .fetchRerankModels()
      .then((rm) => {
        setRerankModels(rm);
        if (rm.length > 0) setSelectedRerank(rm[0]);
        setLoadingModels(false);
      })
      .catch(() => setLoadingModels(false));
  }, []);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const { login, authLoading, authError } = useAIContext();

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (!isAuthenticated || !auth?.token) {
      setShowLoginModal(true);
      return;
    }
    try {
      setIsSearching(true);
      setSearchError(null);

      let effectiveFtsWeight = ftsWeight;
      let effectiveSemanticWeight = semanticWeight;
      if (searchMode === "fts") {
        effectiveFtsWeight = 1.0;
        effectiveSemanticWeight = 0.0;
      } else if (searchMode === "semantic") {
        effectiveFtsWeight = 0.0;
        effectiveSemanticWeight = 1.0;
      }

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

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) return;
    try {
      await login(loginUsername, loginPassword);
      setShowLoginModal(false);
    } catch {
      // Handled by authError in context
    }
  };

  const toggleSourceType = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId)
        ? prev.filter((t) => t !== typeId)
        : [...prev, typeId],
    );
  };

  return (
    <div className="m-page">
      {/* Compact Hero */}
      <section
        className="m-card m-card--roomy m-rise"
        style={{
          borderTop: "2px solid var(--iris-500)",
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
          <div className="m-kicker" style={{ marginBottom: 2 }}>
            Retrieval Engine &amp; Experiments
          </div>
          <h1 className="m-title" style={{ fontSize: "22px", margin: 0 }}>
            Search <em>Playground</em>
          </h1>
        </div>
        <p
          className="m-subtitle"
          style={{
            margin: 0,
            fontSize: "13px",
            maxWidth: 620,
            lineHeight: 1.4,
          }}
        >
          Benchmark Full-Text Search (FTS), Semantic Vector Search, Hybrid RRF,
          and Cross-Encoder Reranking in real-time.
        </p>
      </section>

      {/* Search Engine Workbench */}
      <section className="m-card" style={{ padding: "20px 24px" }}>
        {/* Search Mode Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className={`m-btn ${searchMode === "hybrid" ? "m-btn--primary" : "m-btn--secondary"}`}
            onClick={() => setSearchMode("hybrid")}
            style={{ padding: "6px 14px", fontSize: 13 }}
          >
            <GitMerge size={14} />
            Hybrid Search (FTS + Vector + RRF)
          </button>
          <button
            type="button"
            className={`m-btn ${searchMode === "fts" ? "m-btn--primary" : "m-btn--secondary"}`}
            onClick={() => setSearchMode("fts")}
            style={{ padding: "6px 14px", fontSize: 13 }}
          >
            <Database size={14} />
            Full-Text Search (FTS)
          </button>
          <button
            type="button"
            className={`m-btn ${searchMode === "semantic" ? "m-btn--primary" : "m-btn--secondary"}`}
            onClick={() => setSearchMode("semantic")}
            style={{ padding: "6px 14px", fontSize: 13 }}
          >
            <Layers size={14} />
            Semantic Search (Vector)
          </button>
        </div>

        {/* RRF Weight Controls */}
        {searchMode === "hybrid" && (
          <div
            style={{
              background: "var(--surface)",
              padding: "12px 18px",
              borderRadius: "var(--radius-md)",
              marginBottom: 16,
              border: "1px solid var(--line)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 10,
              }}
            >
              <Sliders size={13} style={{ color: "var(--iris-500)" }} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                RRF Fusion Weight Distribution
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 18,
              }}
            >
              <div>
                <label
                  htmlFor="fts-weight-input"
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span>FTS Weight</span>
                  <strong style={{ color: "var(--text)" }}>
                    {ftsWeight.toFixed(2)}
                  </strong>
                </label>
                <input
                  id="fts-weight-input"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ftsWeight}
                  onChange={(e) => setFtsWeight(parseFloat(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "var(--iris-500)",
                    height: 4,
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="semantic-weight-input"
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span>Semantic Weight</span>
                  <strong style={{ color: "var(--text)" }}>
                    {semanticWeight.toFixed(2)}
                  </strong>
                </label>
                <input
                  id="semantic-weight-input"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={semanticWeight}
                  onChange={(e) =>
                    setSemanticWeight(parseFloat(e.target.value))
                  }
                  style={{
                    width: "100%",
                    accentColor: "var(--iris-500)",
                    height: 4,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Reranking Toggle & Model Selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              id="rerank-toggle"
              checked={enableRerank}
              onChange={(e) => setEnableRerank(e.target.checked)}
              style={{
                width: 15,
                height: 15,
                cursor: "pointer",
                accentColor: "var(--iris-500)",
              }}
            />
            <label
              htmlFor="rerank-toggle"
              style={{ fontSize: 13, cursor: "pointer", color: "var(--text)" }}
            >
              Enable Cross-Encoder Reranking
            </label>
          </div>

          {enableRerank && !loadingModels && rerankModels.length > 0 && (
            <Dropdown
              label="RERANKER"
              options={rerankModels.map((m) => ({
                value: m.id,
                label: m.name || m.id,
                sublabel: m.id,
                badge: m.provider,
              }))}
              value={selectedRerank?.id || ""}
              onChange={(val) => {
                const found = rerankModels.find((m) => m.id === val);
                if (found) setSelectedRerank(found);
              }}
              searchable={rerankModels.length > 3}
            />
          )}
        </div>

        {/* Query Input Box (Always Enabled) */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            type="text"
            className="m-input"
            style={{ flex: 1, height: 42, fontSize: 14 }}
            placeholder="Enter search query — e.g. backup connection error, failed repositories, rate limit..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={isSearching}
          />
          <button
            type="button"
            className="m-btn m-btn--primary"
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            style={{ height: 42, padding: "0 22px", fontSize: 13 }}
          >
            {isSearching
              ? "Searching..."
              : !isAuthenticated
                ? "Sign in & Search"
                : "Search"}
          </button>
        </div>

        {/* Source Filters */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Filter size={12} /> Filter:
          </span>
          {SOURCE_TYPES.map((type) => (
            <button
              type="button"
              key={type.id}
              onClick={() => toggleSourceType(type.id)}
              className={`m-badge ${selectedTypes.includes(type.id) ? "m-badge--accent" : ""}`}
              style={{
                cursor: "pointer",
                padding: "3px 10px",
                fontSize: 12,
                background: selectedTypes.includes(type.id)
                  ? "var(--iris-wash)"
                  : "var(--surface)",
              }}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Results Area */}
        <div>
          {searchError ? (
            <ErrorState message={searchError} />
          ) : isSearching ? (
            <LoadingState message="Executing query and scoring results..." />
          ) : searchResults.length > 0 ? (
            searchResults.map((result) => (
              <div
                key={`${result.source_type}-${result.id}`}
                className="m-card m-card--quiet"
                style={{ marginBottom: 10, padding: "14px 18px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <span
                      className="m-badge m-badge--accent"
                      style={{ fontSize: 11 }}
                    >
                      {result.source_type}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      ID: {result.source_id}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      Score: {result.score.toFixed(4)}
                    </span>
                    {result.reranked && (
                      <span
                        className="m-badge m-badge--positive"
                        style={{ fontSize: 10 }}
                      >
                        Reranked
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 6 }}>
                  <MessageContentRenderer content={result.content} />
                </div>
              </div>
            ))
          ) : query && !isSearching ? (
            <EmptyState
              message="No Results Found"
              description="Try adjusting your query, mode, or source type filters."
              icon={<Search size={22} />}
            />
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "24px 16px",
                color: "var(--text-muted)",
                fontSize: 13,
                border: "1px dashed var(--line)",
                borderRadius: "var(--radius-md)",
              }}
            >
              Enter keywords above and press <strong>Search</strong> to
              benchmark hybrid relevance scores.
            </div>
          )}
        </div>
      </section>

      {/* Quick Sign-In Modal */}
      {showLoginModal && (
        <div className="m-scrim">
          <div className="m-dialog" style={{ maxWidth: 420 }}>
            <h3>Sign In to AI Observatory</h3>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 16,
              }}
            >
              Enter your credentials to query hybrid vector embeddings.
            </p>
            <form onSubmit={handleInlineLogin}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <input
                  type="text"
                  className="m-input"
                  placeholder="Username"
                  autoComplete="username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                />
                <input
                  type="password"
                  className="m-input"
                  placeholder="Password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              {authError && (
                <div
                  className="m-alert m-alert--critical"
                  style={{ marginBottom: 14 }}
                >
                  {authError}
                </div>
              )}
              <div className="m-dialog__foot">
                <button
                  type="button"
                  className="m-btn m-btn--secondary"
                  onClick={() => setShowLoginModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="m-btn m-btn--primary"
                  disabled={authLoading || !loginUsername || !loginPassword}
                >
                  {authLoading ? "Signing in..." : "Sign In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
