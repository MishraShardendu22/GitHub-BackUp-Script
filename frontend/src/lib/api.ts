import { API_BASE_URL } from "@/config/env";

const API_BASE = API_BASE_URL;

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAPI<T>(
  path: string,
  options?: FetchOptions,
): Promise<T> {
  const { retries = 2, retryDelay = 1000, ...fetchOptions } = options || {};
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...fetchOptions,
        headers: {
          "Content-Type": "application/json",
          ...fetchOptions.headers,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("auth:unauthorized"));
          }
        }
        if (res.status >= 500 && attempt < retries) {
          await sleep(retryDelay * (attempt + 1));
          continue;
        }
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || res.statusText);
      }

      return res.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      if (
        attempt < retries &&
        (error instanceof TypeError || lastError.message.includes("fetch"))
      ) {
        await sleep(retryDelay * (attempt + 1));
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("Request failed");
}

export async function safeFetch<T>(
  path: string,
  options?: FetchOptions,
): Promise<T | null> {
  try {
    return await fetchAPI<T>(path, options);
  } catch (error) {
    console.error(`API request failed: ${path}`, error);
    return null;
  }
}
