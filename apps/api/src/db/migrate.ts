import { resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client";

/**
 * `drizzle/` of the API package. Resolved from the working directory, which is the package
 * directory for pnpm scripts and tests, and /app in the Docker image (where the code is bundled,
 * so it cannot be located relative to this file).
 */
export const MIGRATIONS_FOLDER = resolve("drizzle");

export function runMigrations(db: Db) {
  return migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
