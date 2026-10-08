import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { registration, team, user } from "../../db/schema";

export async function insertTeam(db: DbOrTx, values: typeof team.$inferInsert) {
  const [row] = await db.insert(team).values(values).returning({ id: team.id });
  if (!row) throw new Error("insertTeam: aucune ligne insérée");
  return row.id;
}

export async function joinCodeExists(db: DbOrTx, joinCode: string): Promise<boolean> {
  const [row] = await db.select({ id: team.id }).from(team).where(eq(team.joinCode, joinCode));
  return row !== undefined;
}

export async function teamNameExists(db: DbOrTx, eventId: string, name: string): Promise<boolean> {
  const [row] = await db
    .select({ id: team.id })
    .from(team)
    .where(and(eq(team.eventId, eventId), sql`lower(${team.name}) = lower(${name})`));
  return row !== undefined;
}

export async function findTeamByCode(db: DbOrTx, eventId: string, joinCode: string) {
  const [row] = await db
    .select()
    .from(team)
    .where(and(eq(team.eventId, eventId), eq(team.joinCode, joinCode)));
  return row;
}

export async function findTeam(db: DbOrTx, teamId: string) {
  const [row] = await db.select().from(team).where(eq(team.id, teamId));
  return row;
}

export function findTeamsOfEvent(db: DbOrTx, eventId: string) {
  return db
    .select()
    .from(team)
    .where(eq(team.eventId, eventId))
    .orderBy(asc(sql`lower(${team.name})`));
}

/** Confirmed and waitlisted members of the given teams, earliest first. */
export function findTeamMembers(db: DbOrTx, teamIds: string[]) {
  if (teamIds.length === 0) return Promise.resolve([]);
  return db
    .select({
      teamId: sql<string>`${registration.teamId}`,
      userId: registration.userId,
      joinedAt: registration.createdAt,
      status: registration.status,
      name: user.name,
      promo: user.promo,
    })
    .from(registration)
    .innerJoin(user, eq(user.id, registration.userId))
    .where(and(inArray(registration.teamId, teamIds), ne(registration.status, "cancelled")))
    .orderBy(asc(registration.createdAt), asc(registration.id));
}

export async function setTeamCaptain(db: DbOrTx, teamId: string, captainUserId: string) {
  await db.update(team).set({ captainUserId }).where(eq(team.id, teamId));
}

export async function deleteTeam(db: DbOrTx, teamId: string) {
  await db.delete(team).where(eq(team.id, teamId));
}

/** Active members of the largest team of an event (0 without teams). */
export async function largestTeamSize(db: DbOrTx, eventId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`coalesce(max(c), 0)` }).from(
    db
      .select({ c: sql<number>`count(*)`.as("c") })
      .from(registration)
      .where(and(eq(registration.eventId, eventId), ne(registration.status, "cancelled")))
      .groupBy(registration.teamId)
      .having(sql`${registration.teamId} is not null`)
      .as("sizes"),
  );
  return Number(row?.n ?? 0);
}

/** Confirmed and waitlisted registrations of an event. */
export async function countActiveRegistrations(db: DbOrTx, eventId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(registration)
    .where(and(eq(registration.eventId, eventId), ne(registration.status, "cancelled")));
  return Number(row?.n ?? 0);
}

/** Teams with a place and teams waiting for one, per event. */
export async function countTeamsByEvent(db: DbOrTx, eventIds: string[]) {
  const counts = new Map<string, { confirmed: number; waitlisted: number }>();
  if (eventIds.length === 0) return counts;
  const rows = await db
    .select({ eventId: team.eventId, status: team.status, n: sql<number>`count(*)` })
    .from(team)
    .where(inArray(team.eventId, eventIds))
    .groupBy(team.eventId, team.status);
  for (const r of rows) {
    const c = counts.get(r.eventId) ?? { confirmed: 0, waitlisted: 0 };
    c[r.status] = Number(r.n);
    counts.set(r.eventId, c);
  }
  return counts;
}

export async function countConfirmedTeams(db: DbOrTx, eventId: string): Promise<number> {
  return (await countTeamsByEvent(db, [eventId])).get(eventId)?.confirmed ?? 0;
}

export async function maxTeamWaitlistPosition(db: DbOrTx, eventId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${team.waitlistPosition})` })
    .from(team)
    .where(eq(team.eventId, eventId));
  return Number(row?.max ?? 0);
}

/** The next waitlisted teams of an event, in waitlist order. */
export function findFirstWaitlistedTeams(db: DbOrTx, eventId: string, limit: number) {
  return db
    .select({ id: team.id })
    .from(team)
    .where(and(eq(team.eventId, eventId), eq(team.status, "waitlisted")))
    .orderBy(asc(team.waitlistPosition))
    .limit(limit);
}

/** Gives the teams a place, with all their members. Returns the promoted members. */
export async function promoteTeams(db: DbOrTx, teamIds: string[]) {
  if (teamIds.length === 0) return [];
  await db
    .update(team)
    .set({ status: "confirmed", waitlistPosition: null })
    .where(and(inArray(team.id, teamIds), eq(team.status, "waitlisted")));
  const promoted = await db
    .update(registration)
    .set({ status: "confirmed", waitlistPosition: null })
    .where(and(inArray(registration.teamId, teamIds), eq(registration.status, "waitlisted")))
    .returning({ id: registration.id, userId: registration.userId });
  if (promoted.length === 0) return [];
  const contacts = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(
      inArray(
        user.id,
        promoted.map((p) => p.userId),
      ),
    );
  const byId = new Map(contacts.map((c) => [c.id, c]));
  return promoted.flatMap((p) => {
    const contact = byId.get(p.userId);
    return contact
      ? [{ id: p.id, user: { id: contact.id, name: contact.name, email: contact.email } }]
      : [];
  });
}

/** 1-based rank of each waitlisted team among the event's waitlisted teams. */
export async function findTeamWaitlistRanks(db: DbOrTx, teamIds: string[]) {
  if (teamIds.length === 0) return new Map<string, number>();
  const ranked = db
    .select({
      id: team.id,
      rank: sql<number>`row_number() over (partition by ${team.eventId} order by ${team.waitlistPosition})`.as(
        "rank",
      ),
    })
    .from(team)
    .where(eq(team.status, "waitlisted"))
    .as("ranked");
  const rows = await db
    .select({ id: ranked.id, rank: ranked.rank })
    .from(ranked)
    .where(inArray(ranked.id, teamIds));
  return new Map(rows.map((r) => [r.id, Number(r.rank)]));
}
