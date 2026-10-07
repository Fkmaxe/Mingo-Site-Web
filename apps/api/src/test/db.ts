import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { ensureDefaultRolePermissions } from "../core/permissions/defaults";
import { createDb } from "../db/client";
import * as schema from "../db/schema";

export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST manquant (voir .env.example)");
  return url;
}

let instance: ReturnType<typeof createDb> | undefined;

export function getTestDb() {
  instance ??= createDb(testDatabaseUrl(), { max: 5 });
  return instance.db;
}

export async function closeTestDb() {
  await instance?.close();
  instance = undefined;
}

const tableNames = Object.values(schema).flatMap((value) =>
  is(value, PgTable) ? [`"${getTableName(value)}"`] : [],
);

/** Empties every table, then restores reference data (default role permissions). */
export async function resetDb() {
  const db = getTestDb();
  await db.execute(sql.raw(`truncate table ${tableNames.join(", ")} cascade`));
  await ensureDefaultRolePermissions(db);
}
