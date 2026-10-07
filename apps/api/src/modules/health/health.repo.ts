import { sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";

export async function ping(db: DbOrTx): Promise<void> {
  await db.execute(sql`select 1`);
}
