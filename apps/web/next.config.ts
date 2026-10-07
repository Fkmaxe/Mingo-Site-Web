import { existsSync } from "node:fs";
import type { NextConfig } from "next";
import { loadEnv } from "./src/env";

// The single .env lives at the repository root.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");
const env = loadEnv();

const config: NextConfig = {
  transpilePackages: ["@bde/shared"],
  // Biome lints the whole monorepo.
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    // Better Auth is served through the web origin, so its cookies belong to the web.
    return [{ source: "/api/auth/:path*", destination: `${env.API_URL}/api/auth/:path*` }];
  },
};

export default config;
