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
  // Inventory photos (resized by the browser) and payment receipts (PDF up to 8 MB) go
  // through a server action.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // The check-in scanner needs the camera; nothing else does.
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ];
    return [
      {
        source: "/((?!manage/treasury/attachments/).*)",
        headers: [...common, { key: "X-Frame-Options", value: "DENY" }],
      },
      // Payment receipts (PDF) are shown inside the page of their entry.
      {
        source: "/manage/treasury/attachments/:name",
        headers: [...common, { key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
  async redirects() {
    // The showcase used to live under /fr (separate site): keep its links working.
    return [
      { source: "/fr", destination: "/", permanent: true },
      { source: "/fr/:path*", destination: "/:path*", permanent: true },
    ];
  },
  async rewrites() {
    // Better Auth is served through the web origin, so its cookies belong to the web.
    return [{ source: "/api/auth/:path*", destination: `${env.API_URL}/api/auth/:path*` }];
  },
};

export default config;
