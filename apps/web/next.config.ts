import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";
import { loadEnv } from "./src/env";

// The single .env lives at the repository root.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");
const env = loadEnv();

const config: NextConfig = {
  transpilePackages: ["@bde/shared"],
  // Docker image: self-contained server; tracing starts at the monorepo root (pnpm workspace).
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
  // Biome lints the whole monorepo.
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The check-in scanner needs the camera; nothing else does.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async rewrites() {
    // Better Auth is served through the web origin, so its cookies belong to the web.
    return [{ source: "/api/auth/:path*", destination: `${env.API_URL}/api/auth/:path*` }];
  },
};

export default config;
