"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OpenRouterModel } from "@/services/ai.service";

interface ModelSelectorProps {
  models: OpenRouterModel[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  disabled?: boolean;
}

// Extract provider name from model ID
function getProvider(model: OpenRouterModel): string {
  if (model.id.includes("/")) {
    const rawProvider = model.id.split("/")[0];
    const nameMap: Record<string, string> = {
      google: "Google",
      openai: "OpenAI",
      anthropic: "Anthropic",
      nvidia: "NVIDIA",
      cohere: "Cohere",
      deepseek: "DeepSeek",
      meta: "Meta",
      mistralai: "Mistral",
      qwen: "Qwen",
      poolside: "Poolside",
      inclusionai: "InclusionAI",
      meituan: "Meituan",
      openrouter: "OpenRouter",
      kwaipilot: "Kwaipilot",
      "x-ai": "xAI",
    };
    return nameMap[rawProvider.toLowerCase()] || rawProvider;
  }
  return "AI";
}

export function ModelSelector({
  models,
  selectedModel,
  onSelectModel,
  loading,
  error,
  onRefresh,
  disabled = false,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search input when popover opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle key press (Escape to close)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const [sortBy, setSortBy] = useState<"name" | "speed" | "context">("name");

  const activeModelObj = models.find((m) => m.id === selectedModel);
  const activeDisplayName = activeModelObj
    ? activeModelObj.name
    : selectedModel || "Select Model";

  const isFastModel = (modelId: string) => {
    const id = modelId.toLowerCase();
    return (
      id.includes("flash") ||
      id.includes("mini") ||
      id.includes("8b") ||
      id.includes("3b") ||
      id.includes("haiku") ||
      id.includes("nemotron") ||
      id.includes("liquid")
    );
  };

  const filteredModels = models
    .filter(
      (m) =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.id.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === "speed") {
        const aFast = isFastModel(a.id) ? 1 : 0;
        const bFast = isFastModel(b.id) ? 1 : 0;
        if (aFast !== bFast) return bFast - aFast;
      }
      if (sortBy === "context") {
        return (b.context_length || 0) - (a.context_length || 0);
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="custom-model-selector-wrap" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`custom-model-trigger ${isOpen ? "open" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && !loading && !error && setIsOpen(!isOpen)}
        disabled={disabled || loading || !!error}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="custom-model-chip-icon">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <title>Model Chip Icon</title>
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <rect x="9" y="9" width="6" height="6" />
            <path d="M15 2v2M9 2v2M15 20v2M9 20v2M20 15h2M20 9h2M2 15h2M2 9h2" />
          </svg>
        </span>
        <span className="custom-model-label">MODEL</span>
        <span className="custom-model-value">
          {loading ? (
            <span className="custom-model-status-text">Loading…</span>
          ) : error ? (
            <span className="custom-model-status-text error">
              Error loading models
            </span>
          ) : (
            activeDisplayName
          )}
        </span>
        {error ? (
          <button
            type="button"
            className="custom-model-retry-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
          >
            Retry
          </button>
        ) : (
          <span className={`custom-model-arrow ${isOpen ? "rotated" : ""}`}>
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <title>Dropdown Arrow</title>
              <path d="M1 1l4 4 4-4" />
            </svg>
          </span>
        )}
      </button>

      {/* Popover Menu Overlay */}
      {isOpen && (
        <div className="custom-model-popover animate-in">
          {/* Header & Search Filter */}
          <div className="custom-model-popover-header">
            <div className="custom-model-search-box">
              <svg
                className="custom-model-search-icon"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <title>Search Icon</title>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="custom-model-search-input"
                placeholder="Filter free models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="custom-model-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                marginTop: 6,
                fontSize: "11px",
              }}
            >
              <div className="custom-model-count">
                {filteredModels.length} model
                {filteredModels.length === 1 ? "" : "s"}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setSortBy("name")}
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    background:
                      sortBy === "name" ? "var(--accent)" : "transparent",
                    color: sortBy === "name" ? "#fff" : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  A-Z
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("speed")}
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    background:
                      sortBy === "speed" ? "var(--accent)" : "transparent",
                    color:
                      sortBy === "speed" ? "#fff" : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Fastest
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("context")}
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    background:
                      sortBy === "context" ? "var(--accent)" : "transparent",
                    color:
                      sortBy === "context" ? "#fff" : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Context
                </button>
              </div>
            </div>
          </div>

          {/* Model Options List */}
          <div className="custom-model-list" role="listbox">
            {filteredModels.length === 0 ? (
              <div className="custom-model-empty">No matching models found</div>
            ) : (
              filteredModels.map((m) => {
                const isSelected = m.id === selectedModel;
                const provider = getProvider(m);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`custom-model-option ${isSelected ? "selected" : ""}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectModel(m.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                  >
                    <div className="custom-model-option-main">
                      <span className="custom-model-option-name">{m.name}</span>
                      <span className="custom-model-option-id">{m.id}</span>
                    </div>

                    <div className="custom-model-option-meta">
                      <span className="custom-model-provider-badge">
                        {provider}
                      </span>
                      {isSelected && (
                        <span className="custom-model-check-icon">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <title>Check Icon</title>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
