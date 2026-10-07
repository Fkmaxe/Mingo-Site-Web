import { loadEnv } from "../../env";
import { createDb } from "../client";
import { runMigrations } from "../migrate";

const { db, close } = createDb(loadEnv().DATABASE_URL, { max: 1 });
await runMigrations(db);
await close();
console.log("Migrations appliquées.");
