import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Locally DATABASE_URL_TEST comes from the root .env; in CI it is set by the workflow.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

export default defineConfig({
  test: {
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // Tests share one real Postgres database, reset between tests.
    fileParallelism: false,
  },
});
