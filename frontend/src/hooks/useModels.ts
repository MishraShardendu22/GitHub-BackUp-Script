"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpenRouterModel } from "@/services/ai.service";
import { aiService } from "@/services/ai.service";

const STORAGE_KEY = "selected_openrouter_model";

export function useModels() {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setSelectedModel = useCallback((modelId: string) => {
    setSelectedModelState(modelId);
    try {
      localStorage.setItem(STORAGE_KEY, modelId);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await aiService.fetchModels();
      setModels(fetched);

      if (fetched.length > 0) {
        // Restore from localStorage or default to first model
        let saved = "";
        try {
          saved = localStorage.getItem(STORAGE_KEY) || "";
        } catch {
          // localStorage may be unavailable
        }

        const stillAvailable = fetched.some((m) => m.id === saved);
        if (saved && stillAvailable) {
          setSelectedModelState(saved);
        } else {
          // Default to first model and persist
          setSelectedModel(fetched[0].id);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch models");
      console.error("Failed to fetch models", e);
    } finally {
      setLoading(false);
    }
  }, [setSelectedModel]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    models,
    selectedModel,
    setSelectedModel,
    loading,
    error,
    refresh: fetchModels,
  };
}
