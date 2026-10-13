import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import {
  attendance,
  event,
  leaguePoints,
  leagueResult,
  leagueSeason,
  registration,
  sport,
  team,
  tournament,
  tournamentEntrant,
  tournamentMatch,
  user,
} from "../../db/schema";

// ---- Season and sports ----

export async function findSeason(db: DbOrTx, schoolYearId: string) {
  const [row] = await db
    .select()
    .from(leagueSeason)
    .where(eq(leagueSeason.schoolYearId, schoolYearId));
  return row;
}

export async function upsertSeason(
  db: DbOrTx,
  schoolYearId: string,
  values: { name: string; prizes: string; placementPoints: number[]; participationPoints: number },
) {
  await db
    .insert(leagueSeason)
    .values({ schoolYearId, ...values })
    .onConflictDoUpdate({ target: leagueSeason.schoolYearId, set: values });
}

// Count qualified by hand: Drizzle may write bare column names inside a sub-select.
export function findSports(db: DbOrTx) {
  return db
    .select({
      id: sport.id,
      name: sport.name,
      eventCount: sql<number>`(select count(*) from "event" e where e."league_sport_id" = "sport"."id" and e."deleted_at" is null)`,
    })
    .from(sport)
    .orderBy(asc(sql`lower(${sport.name})`));
}

export async function findSport(db: DbOrTx, id: string) {
  const [row] = await db.select().from(sport).where(eq(sport.id, id));
  return row;
}

export async function sportNameTaken(db: DbOrTx, name: string, exceptId?: string) {
  const [row] = await db
    .select({ id: sport.id })
    .from(sport)
    .where(
      sql`lower(${sport.name}) = lower(${name})${exceptId ? sql` and ${sport.id} <> ${exceptId}` : sql``}`,
    );
  return row !== undefined;
}

export async function insertSport(db: DbOrTx, name: string) {
  const [row] = await db.insert(sport).values({ name }).returning({ id: sport.id });
  if (!row) throw new Error("insertSport: aucune ligne insérée");
  return row.id;
}

export async function updateSport(db: DbOrTx, id: string, name: string) {
  await db.update(sport).set({ name }).where(eq(sport.id, id));
}

export async function setEventSport(db: DbOrTx, eventId: string, sportId: string | null) {
  await db.update(event).set({ leagueSportId: sportId }).where(eq(event.id, eventId));
}

// ---- Standings and results ----

/** Points and number of events of every person with points this year, best first. */
export function findStandings(
  db: DbOrTx,
  schoolYearId: string,
  filter: { levelId?: string | undefined; trackId?: string | undefined },
) {
  const perEvent = db
    .select({
      userId: leaguePoints.userId,
      total: sql<number>`sum(${leaguePoints.points})`.as("total"),
    })
    .from(leaguePoints)
    .where(eq(leaguePoints.schoolYearId, schoolYearId))
    .groupBy(leaguePoints.userId, leaguePoints.eventId)
    .as("per_event");
  const points = sql<number>`sum("per_event"."total")::int`;
  return db
    .select({
      id: user.id,
      name: user.name,
      promo: user.promo,
      image: user.image,
      points,
      events: sql<number>`(count(*) filter (where "per_event"."total" > 0))::int`,
    })
    .from(perEvent)
    .innerJoin(user, eq(user.id, perEvent.userId))
    .where(
      and(
        filter.levelId ? eq(user.levelId, filter.levelId) : undefined,
        filter.trackId ? eq(user.trackId, filter.trackId) : undefined,
      ),
    )
    .groupBy(user.id)
    .having(sql`sum("per_event"."total") > 0`)
    .orderBy(desc(points), asc(user.name));
}

/**
 * Points of a person per event this year, latest event first, with their validated place
 * (their own, or their team's).
 */
export function findMyEvents(db: DbOrTx, schoolYearId: string, userId: string) {
  return db
    .select({
      id: event.id,
      slug: event.slug,
      title: event.title,
      startsAt: event.startsAt,
      points: sql<number>`sum(${leaguePoints.points})::int`,
      place: sql<number | null>`(select min(r."place") from "league_result" r
        where r."event_id" = "event"."id" and (r."user_id" = ${userId} or r."team_id" in
          (select g."team_id" from "registration" g where g."event_id" = "event"."id" and g."user_id" = ${userId})))`,
    })
    .from(leaguePoints)
    .innerJoin(event, eq(event.id, leaguePoints.eventId))
    .where(and(eq(leaguePoints.schoolYearId, schoolYearId), eq(leaguePoints.userId, userId)))
    .groupBy(event.id)
    .having(sql`sum(${leaguePoints.points}) <> 0`)
    .orderBy(desc(event.startsAt));
}

/** League events with validated results, latest first. */
export function findValidatedEvents(db: DbOrTx) {
  return db
    .select({
      id: event.id,
      slug: event.slug,
      title: event.title,
      startsAt: event.startsAt,
      sport: sport.name,
    })
    .from(event)
    .innerJoin(sport, eq(sport.id, event.leagueSportId))
    .where(
      and(
        isNull(event.deletedAt),
        sql`exists (select 1 from "league_result" r where r."event_id" = "event"."id")`,
      ),
    )
    .orderBy(desc(event.startsAt));
}

/** Validated placements of the given events, with the name of the person or team. */
export function findResults(db: DbOrTx, eventIds: string[]) {
  if (eventIds.length === 0) return Promise.resolve([]);
  return db
    .select({
      eventId: leagueResult.eventId,
      place: leagueResult.place,
      userId: leagueResult.userId,
      teamId: leagueResult.teamId,
      name: sql<string>`coalesce(${team.name}, ${user.name})`,
    })
    .from(leagueResult)
    .leftJoin(user, eq(user.id, leagueResult.userId))
    .leftJoin(team, eq(team.id, leagueResult.teamId))
    .where(inArray(leagueResult.eventId, eventIds))
    .orderBy(asc(leagueResult.place));
}

export async function replaceResults(
  db: DbOrTx,
  eventId: string,
  rows: { place: number; userId: string | null; teamId: string | null; createdBy: string }[],
) {
  await db.delete(leagueResult).where(eq(leagueResult.eventId, eventId));
  if (rows.length > 0) await db.insert(leagueResult).values(rows.map((r) => ({ eventId, ...r })));
}

/** Current league points of an event, per person and school year (to cancel them). */
export function findEventPointTotals(db: DbOrTx, eventId: string) {
  return db
    .select({
      userId: leaguePoints.userId,
      schoolYearId: leaguePoints.schoolYearId,
      total: sql<number>`sum(${leaguePoints.points})::int`,
    })
    .from(leaguePoints)
    .where(eq(leaguePoints.eventId, eventId))
    .groupBy(leaguePoints.userId, leaguePoints.schoolYearId);
}

export async function insertLeaguePoints(db: DbOrTx, rows: (typeof leaguePoints.$inferInsert)[]) {
  if (rows.length > 0) await db.insert(leaguePoints).values(rows);
}

// ---- Who plays ----

/** Confirmed people (individual event) or confirmed teams (team event), earliest first. */
export function findConfirmedUsers(db: DbOrTx, eventId: string) {
  return db
    .select({ userId: registration.userId, name: user.name })
    .from(registration)
    .innerJoin(user, eq(user.id, registration.userId))
    .where(and(eq(registration.eventId, eventId), eq(registration.status, "confirmed")))
    .orderBy(asc(registration.createdAt), asc(registration.id));
}

export function findConfirmedTeams(db: DbOrTx, eventId: string) {
  return db
    .select({ teamId: team.id, name: team.name })
    .from(team)
    .where(and(eq(team.eventId, eventId), eq(team.status, "confirmed")))
    .orderBy(asc(team.createdAt), asc(team.id));
}

/** People checked in at the entrance of the event. */
export async function findCheckedIn(db: DbOrTx, eventId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: attendance.userId })
    .from(attendance)
    .where(and(eq(attendance.eventId, eventId), eq(attendance.kind, "participant")));
  return rows.map((r) => r.userId);
}

/** Members (not cancelled) of the given teams. */
export function findMembersOfTeams(db: DbOrTx, teamIds: string[]) {
  if (teamIds.length === 0) return Promise.resolve([]);
  return db
    .select({ teamId: sql<string>`${registration.teamId}`, userId: registration.userId })
    .from(registration)
    .where(and(inArray(registration.teamId, teamIds), ne(registration.status, "cancelled")));
}

// ---- Tournament ----

export async function findTournament(db: DbOrTx, eventId: string) {
  const [row] = await db.select().from(tournament).where(eq(tournament.eventId, eventId));
  return row;
}

export async function insertTournament(db: DbOrTx, values: typeof tournament.$inferInsert) {
  const [row] = await db.insert(tournament).values(values).returning();
  if (!row) throw new Error("insertTournament: aucune ligne insérée");
  return row;
}

export async function setTournamentStatus(
  db: DbOrTx,
  id: string,
  status: (typeof tournament.$inferSelect)["status"],
) {
  await db.update(tournament).set({ status }).where(eq(tournament.id, id));
}

export async function deleteTournament(db: DbOrTx, id: string) {
  await db.delete(tournament).where(eq(tournament.id, id));
}

export async function insertEntrants(db: DbOrTx, rows: (typeof tournamentEntrant.$inferInsert)[]) {
  return db.insert(tournamentEntrant).values(rows).returning();
}

export function findEntrants(db: DbOrTx, tournamentId: string) {
  return db
    .select({
      id: tournamentEntrant.id,
      userId: tournamentEntrant.userId,
      teamId: tournamentEntrant.teamId,
      seed: tournamentEntrant.seed,
      pool: tournamentEntrant.pool,
      name: sql<string>`coalesce(${team.name}, ${user.name})`,
    })
    .from(tournamentEntrant)
    .leftJoin(user, eq(user.id, tournamentEntrant.userId))
    .leftJoin(team, eq(team.id, tournamentEntrant.teamId))
    .where(eq(tournamentEntrant.tournamentId, tournamentId))
    .orderBy(asc(tournamentEntrant.seed));
}

export async function insertMatches(db: DbOrTx, rows: (typeof tournamentMatch.$inferInsert)[]) {
  if (rows.length > 0) await db.insert(tournamentMatch).values(rows);
}

export function findMatches(db: DbOrTx, tournamentId: string) {
  return db
    .select()
    .from(tournamentMatch)
    .where(eq(tournamentMatch.tournamentId, tournamentId))
    .orderBy(
      asc(tournamentMatch.phase),
      asc(tournamentMatch.pool),
      asc(tournamentMatch.round),
      asc(tournamentMatch.position),
    );
}

export async function findMatchWithEvent(db: DbOrTx, matchId: string) {
  const [row] = await db
    .select({ match: tournamentMatch, tournament, eventId: tournament.eventId })
    .from(tournamentMatch)
    .innerJoin(tournament, eq(tournament.id, tournamentMatch.tournamentId))
    .where(eq(tournamentMatch.id, matchId));
  return row;
}

export async function updateMatch(
  db: DbOrTx,
  id: string,
  values: Partial<
    Pick<
      typeof tournamentMatch.$inferInsert,
      "entrantAId" | "entrantBId" | "winnerId" | "draw" | "scoreA" | "scoreB" | "updatedBy"
    >
  >,
) {
  await db.update(tournamentMatch).set(values).where(eq(tournamentMatch.id, id));
}
