import { AGENT_URL } from "@/config/env";

export interface EmbeddingModel {
  id: string;
  name: string;
  dimensions: number;
  provider: string;
}

export interface RerankModel {
  id: string;
  name: string;
  provider: string;
}

export interface SearchResult {
  id: number;
  source_type: string;
  source_id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  reranked?: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  generation_id: number;
  model_id: string;
  total: number;
}

export interface GenerationStatus {
  id: number;
  model_id: string;
  dimensions: number;
  status: string;
  total_items: number;
  processed_items: number;
  failed_items: number;
  created_at: string;
  activated_at: string | null;
  job_counts: Record<string, number>;
}

export const searchService = {
  async fetchEmbeddingModels(): Promise<EmbeddingModel[]> {
    try {
      const res = await fetch(`${AGENT_URL}/api/embedding-models`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    } catch {
      return [];
    }
  },

  async fetchRerankModels(): Promise<RerankModel[]> {
    try {
      const res = await fetch(`${AGENT_URL}/api/reranking-models`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    } catch {
      return [];
    }
  },

  async search(
    token: string,
    params: {
      query: string;
      source_types?: string[];
      limit?: number;
      rerank_model_id?: string;
      fts_weight?: number;
      semantic_weight?: number;
    },
  ): Promise<SearchResponse> {
    const res = await fetch(`${AGENT_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      if (res.status === 401)
        window.dispatchEvent(new Event("auth:unauthorized"));
      throw new Error(`Search failed: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data;
  },

  async getGenerationStatus(
    token: string,
    generationId?: number,
  ): Promise<GenerationStatus | null> {
    const url = generationId
      ? `${AGENT_URL}/embeddings/status?generation_id=${generationId}`
      : `${AGENT_URL}/embeddings/status`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401)
        window.dispatchEvent(new Event("auth:unauthorized"));
      throw new Error(`Failed to fetch status: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data;
  },

  async startGeneration(token: string, modelId: string): Promise<unknown> {
    const res = await fetch(`${AGENT_URL}/embeddings/start-generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ model_id: modelId }),
    });
    if (!res.ok) {
      if (res.status === 401)
        window.dispatchEvent(new Event("auth:unauthorized"));
      throw new Error(`Failed to start generation: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data;
  },

  async processBatch(
    token: string,
    generationId: number,
    batchSize?: number,
  ): Promise<unknown> {
    const res = await fetch(`${AGENT_URL}/embeddings/process-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        generation_id: generationId,
        batch_size: batchSize,
      }),
    });
    if (!res.ok) {
      if (res.status === 401)
        window.dispatchEvent(new Event("auth:unauthorized"));
      throw new Error(`Batch processing failed: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data;
  },

  async activateGeneration(token: string, generationId: number): Promise<void> {
    const res = await fetch(
      `${AGENT_URL}/embeddings/activate?generation_id=${generationId}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      if (res.status === 401)
        window.dispatchEvent(new Event("auth:unauthorized"));
      throw new Error(`Failed to activate generation: ${res.statusText}`);
    }
  },

  async switchModel(token: string, modelId: string): Promise<unknown> {
    const res = await fetch(`${AGENT_URL}/embeddings/switch-model`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ model_id: modelId }),
    });
    if (!res.ok) {
      if (res.status === 401)
        window.dispatchEvent(new Event("auth:unauthorized"));
      throw new Error(`Model switch failed: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data;
  },

  async pruneStaleGenerations(token: string): Promise<unknown> {
    const res = await fetch(`${AGENT_URL}/embeddings/prune`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401)
        window.dispatchEvent(new Event("auth:unauthorized"));
      throw new Error(`Failed to prune stale generations: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data;
  },

  async deleteGeneration(
    token: string,
    generationId: number,
  ): Promise<unknown> {
    const res = await fetch(
      `${AGENT_URL}/embeddings/generations/${generationId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      if (res.status === 401)
        window.dispatchEvent(new Event("auth:unauthorized"));
      throw new Error(`Failed to delete generation: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data;
  },
};
