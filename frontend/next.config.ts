import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output mode produces a self-contained server.js bundle
  // required for the Docker multi-stage build (frontend/Dockerfile).
  output: "standalone",
};

export default nextConfig;
