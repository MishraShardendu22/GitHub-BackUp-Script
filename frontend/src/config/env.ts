/**
 * Centralized Environment & System Configuration for Frontend
 * All environment variables (process.env.*) and hardcoded defaults
 * must be extracted here and imported across the application.
 */

export const env = {
  // Service URLs
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  AGENT_URL: process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000",
  WS_BASE_URL:
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8080",

  // Hardcoded UI & Client Limits
  DEFAULT_PAGE_SIZE: 50,
  DEFAULT_LOG_PAGE_SIZE: 100,
  MAX_LIVE_LOGS_BUFFER: 500,
  WS_RECONNECT_DELAY_MS: 3000,
  DEFAULT_FETCH_RETRIES: 2,
  DEFAULT_FETCH_RETRY_DELAY_MS: 1000,
} as const;

export const API_BASE_URL = env.API_BASE_URL;
export const AGENT_URL = env.AGENT_URL;
export const WS_BASE_URL = env.WS_BASE_URL;

export const LOADING_MESSAGES = [
  "🔒 Connecting securely to database pool...",
  "⚙️ Fetching backup execution details...",
  "📊 Aggregating repository telemetry logs...",
  "🧬 Analyzing system health signals...",
  "🔋 Syncing historical report archives...",
] as const;
