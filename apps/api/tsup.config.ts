import { defineConfig } from "tsup";

// Production bundle for the Docker image: every dependency is bundled in, so the image
// needs no node_modules (Better Auth's optional peers would otherwise pull Next.js in).
export default defineConfig({
  entry: {
    index: "src/index.ts",
    migrate: "src/db/scripts/migrate.ts",
    "mail-test": "src/scripts/mail-test.ts",
  },
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: [/.*/],
  // Bundled CommonJS dependencies still call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
