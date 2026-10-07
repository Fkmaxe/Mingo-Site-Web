import { ensureDefaultRolePermissions } from "../../core/permissions";
import { loadEnv } from "../../env";
import { createDb } from "../client";
import { runMigrations } from "../migrate";

const { db, close } = createDb(loadEnv().DATABASE_URL, { max: 1 });
await runMigrations(db);
await ensureDefaultRolePermissions(db);
await close();
console.log("Migrations appliquées.");
