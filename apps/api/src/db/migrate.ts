import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

export function runMigrations(db: Db) {
  return migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
