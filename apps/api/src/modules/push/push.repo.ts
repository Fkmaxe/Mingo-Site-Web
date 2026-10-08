import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { membership, pushSubscription, schoolYear } from "../../db/schema";

/** Same browser re-subscribing (or another account on it): the endpoint moves to this user. */
export async function upsertSubscription(
  db: DbOrTx,
  values: { userId: string; endpoint: string; p256dh: string; auth: string; newEvents: boolean },
) {
  await db
    .insert(pushSubscription)
    .values(values)
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: {
        userId: values.userId,
        p256dh: values.p256dh,
        auth: values.auth,
        newEvents: values.newEvents,
      },
    });
}

export async function deleteSubscription(db: DbOrTx, userId: string, endpoint: string) {
  await db
    .delete(pushSubscription)
    .where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));
}

export async function deleteSubscriptionsByEndpoint(db: DbOrTx, endpoints: string[]) {
  if (endpoints.length === 0) return;
  await db.delete(pushSubscription).where(inArray(pushSubscription.endpoint, endpoints));
}

export async function markSent(db: DbOrTx, endpoints: string[], at: Date) {
  if (endpoints.length === 0) return;
  await db
    .update(pushSubscription)
    .set({ lastSentAt: at })
    .where(inArray(pushSubscription.endpoint, endpoints));
}

export async function setNewEvents(db: DbOrTx, userId: string, newEvents: boolean) {
  await db.update(pushSubscription).set({ newEvents }).where(eq(pushSubscription.userId, userId));
}

export async function findUserSubscriptions(db: DbOrTx, userId: string) {
  return db
    .select({ endpoint: pushSubscription.endpoint, newEvents: pushSubscription.newEvents })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));
}

const target = {
  endpoint: pushSubscription.endpoint,
  p256dh: pushSubscription.p256dh,
  auth: pushSubscription.auth,
};

export function findTargetsOfUsers(db: DbOrTx, userIds: string[]) {
  if (userIds.length === 0) return Promise.resolve([]);
  return db.select(target).from(pushSubscription).where(inArray(pushSubscription.userId, userIds));
}

/**
 * Devices opted in to new events, except `exceptUserId`. `membersOnly`: only users with an
 * active membership of the current school year (events visible to members only).
 */
export function findNewEventTargets(db: DbOrTx, membersOnly: boolean, exceptUserId: string) {
  const conditions = [
    eq(pushSubscription.newEvents, true),
    sql`${pushSubscription.userId} <> ${exceptUserId}`,
    membersOnly
      ? sql`exists (select 1 from ${membership} join ${schoolYear} on ${schoolYear.id} = ${membership.schoolYearId}
          where ${membership.userId} = ${pushSubscription.userId} and ${membership.isActive}
            and ${membership.deletedAt} is null and ${schoolYear.isCurrent})`
      : undefined,
  ];
  return db
    .select(target)
    .from(pushSubscription)
    .where(and(...conditions));
}
