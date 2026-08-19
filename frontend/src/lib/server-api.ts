import "server-only";
import { API_BASE_URL } from "@/config/env";

const API = API_BASE_URL;

export async function serverFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
