import { eq } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { calendarFeed, user } from "../../db/schema";

export async function findFeedOfUser(db: DbOrTx, userId: string) {
  const [row] = await db.select().from(calendarFeed).where(eq(calendarFeed.userId, userId));
  return row;
}

/** Creates the user's link, or replaces its token (the old link stops working). */
export async function upsertFeed(db: DbOrTx, userId: string, token: string, now: Date) {
  await db
    .insert(calendarFeed)
    .values({ userId, token })
    .onConflictDoUpdate({
      target: calendarFeed.userId,
      set: { token, createdAt: now, lastFetchedAt: null },
    });
}

export async function deleteFeed(db: DbOrTx, userId: string) {
  await db.delete(calendarFeed).where(eq(calendarFeed.userId, userId));
}

/** The owner of a feed token, or undefined. */
export async function findFeedOwner(db: DbOrTx, token: string) {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(calendarFeed)
    .innerJoin(user, eq(user.id, calendarFeed.userId))
    .where(eq(calendarFeed.token, token));
  return row;
}

export async function markFeedFetched(db: DbOrTx, token: string, now: Date) {
  await db.update(calendarFeed).set({ lastFetchedAt: now }).where(eq(calendarFeed.token, token));
}
