import type { RegistrationStatus } from "@bde/shared";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import { event, registration, user } from "../../db/schema";

export async function countConfirmedByEvent(db: DbOrTx, eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ eventId: registration.eventId, n: count() })
    .from(registration)
    .where(and(inArray(registration.eventId, eventIds), eq(registration.status, "confirmed")))
    .groupBy(registration.eventId);
  return new Map(rows.map((r) => [r.eventId, r.n]));
}

export async function findUserRegistrations(db: DbOrTx, userId: string, eventIds: string[]) {
  if (eventIds.length === 0) return [];
  return db
    .select({ id: registration.id, eventId: registration.eventId, status: registration.status })
    .from(registration)
    .where(and(eq(registration.userId, userId), inArray(registration.eventId, eventIds)));
}

/** Serializes registrations of one event until the end of the transaction (capacity check). */
export async function lockEventRegistrations(tx: DbOrTx, eventId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`registration:${eventId}`}))`);
}

export async function countConfirmed(db: DbOrTx, eventId: string): Promise<number> {
  return (await countConfirmedByEvent(db, [eventId])).get(eventId) ?? 0;
}

export async function findRegistration(db: DbOrTx, eventId: string, userId: string) {
  const [row] = await db
    .select()
    .from(registration)
    .where(and(eq(registration.eventId, eventId), eq(registration.userId, userId)));
  return row;
}

export async function insertRegistration(db: DbOrTx, values: typeof registration.$inferInsert) {
  const [row] = await db.insert(registration).values(values).returning({ id: registration.id });
  if (!row) throw new Error("insertRegistration: aucune ligne insérée");
  return row.id;
}

export async function updateRegistration(
  db: DbOrTx,
  registrationId: string,
  values: Patch<typeof registration.$inferInsert>,
) {
  await db.update(registration).set(compact(values)).where(eq(registration.id, registrationId));
}

const ticketSelection = {
  id: registration.id,
  userId: registration.userId,
  status: registration.status,
  qrToken: registration.qrToken,
  createdAt: registration.createdAt,
  cancelledAt: registration.cancelledAt,
  event: {
    id: event.id,
    slug: event.slug,
    title: event.title,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    status: event.status,
    capacity: event.capacity,
    customFields: event.customFieldsSchema,
  },
  waitlistPosition: registration.waitlistPosition,
  answers: registration.answers,
};

export type TicketRow = NonNullable<Awaited<ReturnType<typeof findTicket>>>;

export async function findTicket(db: DbOrTx, registrationId: string) {
  const [row] = await db
    .select(ticketSelection)
    .from(registration)
    .innerJoin(event, eq(event.id, registration.eventId))
    .where(eq(registration.id, registrationId));
  return row;
}

export function findUserTickets(db: DbOrTx, userId: string, scope: "upcoming" | "past", now: Date) {
  const upcoming = scope === "upcoming";
  return db
    .select(ticketSelection)
    .from(registration)
    .innerJoin(event, eq(event.id, registration.eventId))
    .where(
      and(
        eq(registration.userId, userId),
        ne(registration.status, "cancelled"),
        upcoming ? gte(event.endsAt, now) : lt(event.endsAt, now),
      ),
    )
    .orderBy(upcoming ? asc(event.startsAt) : desc(event.startsAt))
    .limit(100);
}

export function findRegistrants(
  db: DbOrTx,
  params: {
    eventId: string;
    status: RegistrationStatus | undefined;
    /** `createdAtKey` is the exact Postgres value (microseconds), as returned by this query. */
    after: { createdAtKey: string; id: string } | null;
    limit: number;
  },
) {
  const conditions: (SQL | undefined)[] = [
    eq(registration.eventId, params.eventId),
    params.status ? eq(registration.status, params.status) : undefined,
    params.after
      ? sql`(${registration.createdAt}, ${registration.id}) > (${params.after.createdAtKey}::timestamptz, ${params.after.id}::uuid)`
      : undefined,
  ];
  return db
    .select({
      id: registration.id,
      status: registration.status,
      createdAt: registration.createdAt,
      answers: registration.answers,
      // JS dates stop at milliseconds: the cursor keeps Postgres' full precision.
      createdAtKey: sql<string>`${registration.createdAt}::text`,
      user: { id: user.id, name: user.name, email: user.email, promo: user.promo },
    })
    .from(registration)
    .innerJoin(user, eq(user.id, registration.userId))
    .where(and(...conditions))
    .orderBy(asc(registration.createdAt), asc(registration.id))
    .limit(params.limit + 1);
}

const participantSelection = {
  id: registration.id,
  eventId: registration.eventId,
  status: registration.status,
  user: { id: user.id, name: user.name, email: user.email, promo: user.promo },
};

export async function findParticipantByToken(db: DbOrTx, qrToken: string) {
  const [row] = await db
    .select(participantSelection)
    .from(registration)
    .innerJoin(user, eq(user.id, registration.userId))
    .where(eq(registration.qrToken, qrToken));
  return row;
}

export async function findParticipant(db: DbOrTx, eventId: string, userId: string) {
  const [row] = await db
    .select(participantSelection)
    .from(registration)
    .innerJoin(user, eq(user.id, registration.userId))
    .where(and(eq(registration.eventId, eventId), eq(registration.userId, userId)));
  return row;
}

/** Confirmed registrants whose name or email contains `query` (case-insensitive, wildcards escaped). */
export function searchConfirmedParticipants(db: DbOrTx, eventId: string, query: string) {
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select(participantSelection)
    .from(registration)
    .innerJoin(user, eq(user.id, registration.userId))
    .where(
      and(
        eq(registration.eventId, eventId),
        eq(registration.status, "confirmed"),
        or(ilike(user.name, pattern), ilike(user.email, pattern)),
      ),
    )
    .orderBy(asc(user.name))
    .limit(20);
}

export function findAllRegistrants(db: DbOrTx, eventId: string) {
  return db
    .select({
      id: registration.id,
      status: registration.status,
      createdAt: registration.createdAt,
      answers: registration.answers,
      user: { id: user.id, name: user.name, email: user.email, promo: user.promo },
    })
    .from(registration)
    .innerJoin(user, eq(user.id, registration.userId))
    .where(eq(registration.eventId, eventId))
    .orderBy(asc(user.name));
}

export async function maxWaitlistPosition(db: DbOrTx, eventId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${registration.waitlistPosition})` })
    .from(registration)
    .where(and(eq(registration.eventId, eventId), eq(registration.status, "waitlisted")));
  return Number(row?.max ?? 0);
}

/** The next waitlisted registrations, in waitlist order. */
export function findFirstWaitlisted(db: DbOrTx, eventId: string, limit: number) {
  return db
    .select({ id: registration.id, user: { name: user.name, email: user.email } })
    .from(registration)
    .innerJoin(user, eq(user.id, registration.userId))
    .where(and(eq(registration.eventId, eventId), eq(registration.status, "waitlisted")))
    .orderBy(asc(registration.waitlistPosition))
    .limit(limit);
}

export async function promoteRegistrations(db: DbOrTx, ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(registration)
    .set({ status: "confirmed", waitlistPosition: null })
    .where(and(inArray(registration.id, ids), eq(registration.status, "waitlisted")));
}

/** 1-based rank of each waitlisted registration of the given ids (others are absent). */
export async function findWaitlistRanks(db: DbOrTx, registrationIds: string[]) {
  if (registrationIds.length === 0) return new Map<string, number>();
  const ranked = db
    .select({
      id: registration.id,
      rank: sql<number>`row_number() over (partition by ${registration.eventId} order by ${registration.waitlistPosition})`.as(
        "rank",
      ),
    })
    .from(registration)
    .where(eq(registration.status, "waitlisted"))
    .as("ranked");
  const rows = await db
    .select({ id: ranked.id, rank: ranked.rank })
    .from(ranked)
    .where(inArray(ranked.id, registrationIds));
  return new Map(rows.map((r) => [r.id, Number(r.rank)]));
}

export async function countWaitlistedByEvent(db: DbOrTx, eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ eventId: registration.eventId, n: count() })
    .from(registration)
    .where(and(inArray(registration.eventId, eventIds), eq(registration.status, "waitlisted")))
    .groupBy(registration.eventId);
  return new Map(rows.map((r) => [r.eventId, r.n]));
}

/** Confirmed and waitlisted people of an event, to notify them. */
export function findActiveRegistrantContacts(db: DbOrTx, eventId: string) {
  return db
    .select({ id: registration.id, user: { name: user.name, email: user.email } })
    .from(registration)
    .innerJoin(user, eq(user.id, registration.userId))
    .where(and(eq(registration.eventId, eventId), ne(registration.status, "cancelled")));
}

/**
 * Claims confirmed registrations of published events starting in (from, to] whose reminder
 * was not sent: marks them as sent and returns what the mail needs. Rows locked by a
 * concurrent run are skipped, so a reminder is never claimed twice.
 */
export async function claimDueReminders(db: DbOrTx, from: Date, to: Date, now: Date) {
  const due = await db
    .select({ id: registration.id })
    .from(registration)
    .innerJoin(event, eq(event.id, registration.eventId))
    .where(
      and(
        eq(registration.status, "confirmed"),
        sql`${registration.reminderSentAt} is null`,
        eq(event.status, "published"),
        sql`${event.deletedAt} is null`,
        sql`${event.startsAt} > ${from.toISOString()}::timestamptz`,
        sql`${event.startsAt} <= ${to.toISOString()}::timestamptz`,
      ),
    )
    .limit(500)
    .for("update", { of: registration, skipLocked: true });
  const ids = due.map((r) => r.id);
  if (ids.length === 0) return [];
  await db.update(registration).set({ reminderSentAt: now }).where(inArray(registration.id, ids));
  return db
    .select({
      id: registration.id,
      user: { name: user.name, email: user.email },
      event: {
        title: event.title,
        slug: event.slug,
        startsAt: event.startsAt,
        location: event.location,
      },
    })
    .from(registration)
    .innerJoin(user, eq(user.id, registration.userId))
    .innerJoin(event, eq(event.id, registration.eventId))
    .where(inArray(registration.id, ids));
}
