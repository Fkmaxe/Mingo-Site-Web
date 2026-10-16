import type { DbOrTx } from "../../db/client";
import { discordPost } from "../../db/schema";

/** Claims a post sent once: true the first time for `key`, false after. */
export async function claimPost(db: DbOrTx, key: string): Promise<boolean> {
  const rows = await db
    .insert(discordPost)
    .values({ key })
    .onConflictDoNothing()
    .returning({ id: discordPost.id });
  return rows.length > 0;
}
