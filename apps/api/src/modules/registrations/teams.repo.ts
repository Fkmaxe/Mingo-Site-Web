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
