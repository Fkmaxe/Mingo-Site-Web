import { sql } from "drizzle-orm";
import { createDb } from "../db/client";
import { runMigrations } from "../db/migrate";
import { testDatabaseUrl } from "./db";

/** Rebuilds the test database from the migrations, so tests always run on the committed schema. */
export default async function setup() {
  const { db, close } = createDb(testDatabaseUrl(), { max: 1 });
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`create schema public`);
  await runMigrations(db);
  await close();
}
