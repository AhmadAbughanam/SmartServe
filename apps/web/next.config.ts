import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output creates a self-contained build for Docker deployment.
  // Does not affect `next dev` or non-Docker `next start`.
  output: "standalone",
  // Trace from the monorepo root so standalone output has consistent paths.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  webpack: (config) => {
    // Disable persistent file-system cache on Windows to prevent
    // ENOENT errors from concurrent pack.gz writes during dev.
    // Applies to both client and server webpack compilations.
    config.cache = { type: "memory" as const };
    return config;
  },
};

export default nextConfig;
