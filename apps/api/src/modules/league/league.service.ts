import {
  type CreateTournamentData,
  DEFAULT_LEAGUE_NAME,
  DEFAULT_PARTICIPATION_POINTS,
  DEFAULT_PLACEMENT_POINTS,
  type EventLeagueDto,
  type LeagueDto,
  type LeagueSeasonInput,
  type MyLeagueDto,
  type RecordMatchData,
  type TournamentDto,
  type TournamentMatchDto,
  type ValidateLeagueResultsInput,
} from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx, Ctx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction, inTransactionWithEffects } from "../../core/tx";
import type { DbOrTx } from "../../db/client";
import type { tournamentMatch } from "../../db/schema";
import { canManageEvent, type EventRow, findManageableEvent, findVisibleEvent } from "../events";
import { avatarPath } from "../me";
import { leagueResultPush } from "../push";
import { currentSchoolYear, requireCurrentSchoolYear } from "../school-years";
import {
  deleteTournament,
  findCheckedIn,
  findConfirmedTeams,
  findConfirmedUsers,
  findEntrants,
  findEventPointTotals,
  findMatches,
  findMatchWithEvent,
  findMembersOfTeams,
  findMyEvents,
  findResults,
  findSeason,
  findSport,
  findSports,
  findStandings,
  findTournament,
  findValidatedEvents,
  insertEntrants,
  insertLeaguePoints,
  insertMatches,
  insertSport,
  insertTournament,
  replaceResults,
  setEventSport,
  setTournamentStatus,
  sportNameTaken,
  updateMatch,
  updateSport,
  upsertSeason,
} from "./league.repo";
import {
  type BracketMatch,
  buildBracket,
  competitionRanks,
  eventPoints,
  finalRanking,
  formatProblem,
  isComplete,
  type PoolMatch,
  poolStandings,
  propagate,
  roundRobin,
  seedsFromPools,
  splitIntoPools,
  voidedResults,
} from "./rules";

type MatchRow = typeof tournamentMatch.$inferSelect;
type Season = {
  name: string;
  prizes: string;
  placementPoints: number[];
  participationPoints: number;
};

const POOL_NAMES = "ABCDEFGHIJKLMNOP";

const notFound = (what: string) => new AppError("NOT_FOUND", 404, what);

const DEFAULT_SEASON: Season = {
  name: DEFAULT_LEAGUE_NAME,
  prizes: "",
  placementPoints: [...DEFAULT_PLACEMENT_POINTS],
  participationPoints: DEFAULT_PARTICIPATION_POINTS,
};

// ---- Season ----

async function seasonOf(db: DbOrTx, schoolYearId: string): Promise<Season> {
  const row = await findSeason(db, schoolYearId);
  return row
    ? {
        name: row.name,
        prizes: row.prizes,
        placementPoints: row.placementPoints,
        participationPoints: row.participationPoints,
      }
    : DEFAULT_SEASON;
}

/** Season settings, sports, overall standings (optionally for one class) and results. */
export async function getLeague(
  ctx: Ctx,
  filter: { levelId?: string | undefined; trackId?: string | undefined },
): Promise<LeagueDto> {
  const year = await requireCurrentSchoolYear(ctx);
  const [season, sports, standings, events] = await Promise.all([
    seasonOf(ctx.db, year.id),
    findSports(ctx.db),
    findStandings(ctx.db, year.id, filter),
    findValidatedEvents(ctx.db),
  ]);
  const results = await findResults(
    ctx.db,
    events.map((e) => e.id),
  );
  const ranks = competitionRanks(standings.map((s) => s.points));
  return {
    season: { schoolYear: year.label, ...season },
    sports: sports.map((s) => ({ ...s, eventCount: Number(s.eventCount) })),
    standings: standings.map((s, i) => ({
      rank: ranks[i] ?? i + 1,
      user: {
        id: s.id,
        name: s.name,
        promo: s.promo,
        avatarUrl: s.image ? avatarPath(s.image) : null,
      },
      points: s.points,
      events: s.events,
    })),
    events: events.map((e) => ({
      ...e,
      startsAt: e.startsAt.toISOString(),
      podium: results
        .filter((r) => r.eventId === e.id && r.place <= 3)
        .map((r) => ({ place: r.place, name: r.name })),
    })),
    canManage: ctx.permissions.has("league:manage"),
  };
}

/** Rank, points and events of the signed-in person this season (home page, profile). */
export async function getMyLeague(ctx: AuthedCtx): Promise<MyLeagueDto> {
  const year = await currentSchoolYear(ctx);
  if (!year) return { seasonName: null, rank: null, points: 0, ranked: 0, events: [] };
  const [season, standings, events] = await Promise.all([
    seasonOf(ctx.db, year.id),
    findStandings(ctx.db, year.id, {}),
    findMyEvents(ctx.db, year.id, ctx.user.id),
  ]);
  const ranks = competitionRanks(standings.map((s) => s.points));
  const index = standings.findIndex((s) => s.id === ctx.user.id);
  return {
    seasonName: season.name,
    rank: index === -1 ? null : (ranks[index] ?? null),
    points: index === -1 ? 0 : (standings[index]?.points ?? 0),
    ranked: standings.length,
    events: events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString() })),
  };
}

export async function saveSeason(ctx: AuthedCtx, input: LeagueSeasonInput) {
  const year = await requireCurrentSchoolYear(ctx);
  await inTransaction(ctx.db, async (tx) => {
    await upsertSeason(tx, year.id, input);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "league_season.updated",
      entity: "league_season",
      entityId: year.id,
      payload: { ...input },
    });
  });
  return getLeague(ctx, {});
}

const sportTaken = (name: string) =>
  new AppError("ALREADY_EXISTS", 409, `Le sport « ${name} » existe déjà.`);

export async function createSport(ctx: AuthedCtx, name: string) {
  await inTransaction(ctx.db, async (tx) => {
    if (await sportNameTaken(tx, name)) throw sportTaken(name);
    const id = await insertSport(tx, name);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "sport.created",
      entity: "sport",
      entityId: id,
      payload: { name },
    });
  });
  return getLeague(ctx, {});
}

export async function editSport(ctx: AuthedCtx, id: string, name: string) {
  const before = await findSport(ctx.db, id);
  if (!before) throw notFound("Ce sport n'existe pas.");
  await inTransaction(ctx.db, async (tx) => {
    if (await sportNameTaken(tx, name, id)) throw sportTaken(name);
    await updateSport(tx, id, name);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "sport.updated",
      entity: "sport",
      entityId: id,
      payload: { from: before.name, to: name },
    });
  });
  return getLeague(ctx, {});
}

// ---- Event: league flag, tournament, results ----

const isTeamEvent = (row: EventRow) => row.teamMinSize !== null && row.teamMaxSize !== null;

function poolMatch(m: MatchRow): PoolMatch {
  return {
    pool: m.pool ?? 0,
    a: m.entrantAId ?? "",
    b: m.entrantBId ?? "",
    result: m.draw
      ? "draw"
      : m.winnerId && m.winnerId === m.entrantAId
        ? "a"
        : m.winnerId && m.winnerId === m.entrantBId
          ? "b"
          : null,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
  };
}

function bracketMatch(m: MatchRow): BracketMatch {
  return {
    kind: m.phase === "third_place" ? "third_place" : "bracket",
    round: m.round,
    position: m.position,
    a: m.entrantAId,
    b: m.entrantBId,
    winner: m.winnerId,
  };
}

const sameSlot = (m: MatchRow, b: BracketMatch) =>
  (b.kind === "third_place" ? m.phase === "third_place" : m.phase === "bracket") &&
  m.round === b.round &&
  m.position === b.position;

function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return "Finale";
  if (fromEnd === 1) return "Demi-finales";
  if (fromEnd === 2) return "Quarts de finale";
  if (fromEnd === 3) return "Huitièmes de finale";
  return `Tour ${round}`;
}

type TournamentRow = NonNullable<Awaited<ReturnType<typeof findTournament>>>;

async function tournamentDto(db: DbOrTx, t: TournamentRow): Promise<TournamentDto> {
  const [entrants, matches] = await Promise.all([findEntrants(db, t.id), findMatches(db, t.id)]);
  const name = new Map(entrants.map((e) => [e.id, e.name]));
  const side = (id: string | null) => (id ? { id, name: name.get(id) ?? "?" } : null);
  const bracketRows = matches.filter((m) => m.phase !== "pool");
  const bracket = bracketRows.map(bracketMatch);
  const rounds = Math.max(0, ...bracket.filter((m) => m.kind === "bracket").map((m) => m.round));

  // A bracket result is editable while the matches it feeds are not played.
  const editableBracket = (m: MatchRow) => {
    if (!m.entrantAId || !m.entrantBId) return false;
    if (m.phase === "third_place" || m.round === rounds) return true;
    const fed = bracket.filter(
      (b) =>
        (b.kind === "bracket" &&
          b.round === m.round + 1 &&
          b.position === Math.floor(m.position / 2)) ||
        (b.kind === "third_place" && m.round === rounds - 1),
    );
    return fed.every((b) => !b.winner);
  };
  const toDto = (m: MatchRow, editable: boolean): TournamentMatchDto => ({
    id: m.id,
    phase: m.phase,
    pool: m.pool,
    round: m.round,
    position: m.position,
    a: side(m.entrantAId),
    b: side(m.entrantBId),
    winnerId: m.winnerId,
    draw: m.draw,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    live: m.startedAt !== null && !m.winnerId && !m.draw,
    editable,
  });

  const poolTables = Array.from({ length: t.format === "bracket" ? 0 : t.poolCount }, (_, pool) => {
    const ids = entrants.filter((e) => e.pool === pool).map((e) => e.id);
    const rows = matches.filter((m) => m.phase === "pool" && m.pool === pool);
    return { pool, ids, rows, standings: poolStandings(ids, rows.map(poolMatch)) };
  });

  return {
    id: t.id,
    format: t.format,
    poolCount: t.poolCount,
    qualifiersPerPool: t.qualifiersPerPool,
    thirdPlace: t.thirdPlace,
    status: t.status,
    entrants: entrants.map((e) => ({
      id: e.id,
      name: e.name,
      userId: e.userId,
      teamId: e.teamId,
      seed: e.seed,
      pool: e.pool,
    })),
    pools: poolTables.map((p) => ({
      index: p.pool,
      name: `Poule ${POOL_NAMES[p.pool] ?? p.pool + 1}`,
      standings: p.standings.map((s, rank) => ({
        entrantId: s.entrantId,
        name: name.get(s.entrantId) ?? "?",
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        points: s.points,
        diff: s.diff,
        qualified: t.format === "pools_bracket" && rank < t.qualifiersPerPool,
      })),
      matches: p.rows.map((m) => toDto(m, t.status === "pools")),
    })),
    rounds: Array.from({ length: rounds }, (_, i) => i + 1).map((round) => ({
      round,
      name: roundName(round, rounds),
      matches: bracketRows
        .filter((m) => m.phase === "bracket" && m.round === round)
        .map((m) => toDto(m, editableBracket(m))),
    })),
    thirdPlaceMatch: (() => {
      const m = bracketRows.find((r) => r.phase === "third_place");
      return m ? toDto(m, editableBracket(m)) : null;
    })(),
    ranking: finalRanking({
      entrants: entrants.map((e) => e.id),
      pools: poolTables.map((p) => p.standings),
      bracket,
    }),
  };
}

/** League flag, tournament and results of an event, for anyone signed in who can see it. */
export async function getEventLeague(ctx: AuthedCtx, eventRef: string): Promise<EventLeagueDto> {
  const row = await findVisibleEvent(ctx, eventRef);
  const canManage = canManageEvent(ctx, row);
  const teamEvent = isTeamEvent(row);
  // Without a current school year (between two years), the default scale is shown.
  const year = await currentSchoolYear(ctx);
  const [sport, t, results, season, users, teams, sports] = await Promise.all([
    row.leagueSportId ? findSport(ctx.db, row.leagueSportId) : undefined,
    findTournament(ctx.db, row.id),
    findResults(ctx.db, [row.id]),
    year ? seasonOf(ctx.db, year.id) : DEFAULT_SEASON,
    canManage && !teamEvent ? findConfirmedUsers(ctx.db, row.id) : [],
    canManage && teamEvent ? findConfirmedTeams(ctx.db, row.id) : [],
    canManage ? findSports(ctx.db) : [],
  ]);
  return {
    sport: sport ? { id: sport.id, name: sport.name } : null,
    canManage,
    teamEvent,
    tournament: t ? await tournamentDto(ctx.db, t) : null,
    results:
      results.length > 0
        ? {
            placements: results.map((r) => ({
              place: r.place,
              name: r.name,
              userId: r.userId,
              teamId: r.teamId,
            })),
          }
        : null,
    rewardedPlaces: season.placementPoints.length,
    sports: sports.map((s) => ({ id: s.id, name: s.name })),
    candidates: [
      ...users.map((u) => ({ userId: u.userId, teamId: null, name: u.name })),
      ...teams.map((tm) => ({ userId: null, teamId: tm.teamId, name: tm.name })),
    ],
  };
}

export async function setLeagueSport(ctx: AuthedCtx, eventId: string, sportId: string | null) {
  const row = await findManageableEvent(ctx, eventId);
  if (sportId && !(await findSport(ctx.db, sportId))) throw notFound("Ce sport n'existe pas.");
  await inTransaction(ctx.db, async (tx) => {
    await setEventSport(tx, row.id, sportId);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "event.league_sport_set",
      entity: "event",
      entityId: row.id,
      payload: { sportId },
    });
  });
  return getEventLeague(ctx, row.id);
}

/** Pool matches of every pool, numbered by round within each pool. */
function poolMatchRows(tournamentId: string, pools: string[][]) {
  return pools.flatMap((ids, pool) =>
    roundRobin(ids).map((m, position) => ({
      tournamentId,
      phase: "pool" as const,
      pool,
      round: m.round,
      position,
      entrantAId: m.a,
      entrantBId: m.b,
    })),
  );
}

function bracketRows(tournamentId: string, bracket: BracketMatch[]) {
  return bracket.map((m) => ({
    tournamentId,
    phase: m.kind === "third_place" ? ("third_place" as const) : ("bracket" as const),
    pool: null,
    round: m.round,
    position: m.position,
    entrantAId: m.a,
    entrantBId: m.b,
    winnerId: m.winner,
  }));
}

/**
 * Creates the tournament of an event with its entrants (people or teams, checked in or
 * registered, in registration order) and draws the pools, or the bracket without pools.
 */
export async function createTournament(
  ctx: AuthedCtx,
  eventId: string,
  input: CreateTournamentData,
) {
  const row = await findManageableEvent(ctx, eventId);
  if (await findTournament(ctx.db, row.id)) {
    throw new AppError("TOURNAMENT_EXISTS", 409, "Cet événement a déjà un tournoi.");
  }
  const teamEvent = isTeamEvent(row);
  const checkedIn = new Set(
    input.source === "checked_in" ? await findCheckedIn(ctx.db, row.id) : [],
  );
  let entrants: { userId: string | null; teamId: string | null }[];
  if (teamEvent) {
    const teams = await findConfirmedTeams(ctx.db, row.id);
    const members = await findMembersOfTeams(
      ctx.db,
      teams.map((t) => t.teamId),
    );
    entrants = teams
      .filter(
        (t) =>
          input.source === "registered" ||
          members.some((m) => m.teamId === t.teamId && checkedIn.has(m.userId)),
      )
      .map((t) => ({ userId: null, teamId: t.teamId }));
  } else {
    entrants = (await findConfirmedUsers(ctx.db, row.id))
      .filter((u) => input.source === "registered" || checkedIn.has(u.userId))
      .map((u) => ({ userId: u.userId, teamId: null }));
  }
  const problem = formatProblem(entrants.length, input);
  if (problem) throw new AppError("INVALID_TOURNAMENT", 422, problem);

  await inTransaction(ctx.db, async (tx) => {
    const withPools = input.format !== "bracket";
    const t = await insertTournament(tx, {
      eventId: row.id,
      format: input.format,
      poolCount: withPools ? input.poolCount : 0,
      qualifiersPerPool: input.format === "pools_bracket" ? input.qualifiersPerPool : 0,
      thirdPlace: input.format !== "pools" && input.thirdPlace,
      status: withPools ? "pools" : "bracket",
      createdBy: ctx.user.id,
    });
    // Pools first, so the entrants are stored with their pool.
    const poolOf = new Map<number, number>();
    if (withPools) {
      splitIntoPools(
        entrants.map((_, i) => i),
        input.poolCount,
      ).forEach((members, pool) => {
        for (const i of members) poolOf.set(i, pool);
      });
    }
    const inserted = await insertEntrants(
      tx,
      entrants.map((e, i) => ({
        tournamentId: t.id,
        ...e,
        seed: i + 1,
        pool: poolOf.get(i) ?? null,
      })),
    );
    const ids = inserted.sort((x, y) => x.seed - y.seed).map((e) => e.id);
    if (withPools) {
      const pools = Array.from({ length: input.poolCount }, (_, pool) =>
        inserted
          .filter((e) => e.pool === pool)
          .sort((x, y) => x.seed - y.seed)
          .map((e) => e.id),
      );
      await insertMatches(tx, poolMatchRows(t.id, pools));
    } else {
      await insertMatches(
        tx,
        bracketRows(
          t.id,
          buildBracket(
            ids.map((id) => ({ id })),
            input.thirdPlace,
          ),
        ),
      );
    }
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "tournament.created",
      entity: "tournament",
      entityId: t.id,
      payload: { eventId: row.id, format: input.format, entrants: ids.length },
    });
  });
  return getEventLeague(ctx, row.id);
}

export async function removeTournament(ctx: AuthedCtx, eventId: string) {
  const row = await findManageableEvent(ctx, eventId);
  const t = await findTournament(ctx.db, row.id);
  if (!t) throw notFound("Cet événement n'a pas de tournoi.");
  await inTransaction(ctx.db, async (tx) => {
    await deleteTournament(tx, t.id);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "tournament.deleted",
      entity: "tournament",
      entityId: t.id,
      payload: { eventId: row.id },
    });
  });
  return getEventLeague(ctx, row.id);
}

/** Pools finished: the best of each pool go to the knockout bracket, pools crossed. */
export async function drawBracket(ctx: AuthedCtx, eventId: string) {
  const row = await findManageableEvent(ctx, eventId);
  const t = await findTournament(ctx.db, row.id);
  if (!t) throw notFound("Cet événement n'a pas de tournoi.");
  if (t.format !== "pools_bracket" || t.status !== "pools") {
    throw new AppError("BRACKET_EXISTS", 409, "L'arbre de ce tournoi est déjà tiré.");
  }
  const dto = await tournamentDto(ctx.db, t);
  if (dto.pools.some((p) => p.matches.some((m) => !m.winnerId && !m.draw))) {
    throw new AppError(
      "POOLS_NOT_FINISHED",
      409,
      "Tous les matchs de poule doivent avoir un résultat avant de tirer l'arbre.",
    );
  }
  const tables = dto.pools.map((p) => p.standings.map((s) => s.entrantId));
  await inTransaction(ctx.db, async (tx) => {
    await insertMatches(
      tx,
      bracketRows(t.id, buildBracket(seedsFromPools(tables, t.qualifiersPerPool), t.thirdPlace)),
    );
    await setTournamentStatus(tx, t.id, "bracket");
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "tournament.bracket_drawn",
      entity: "tournament",
      entityId: t.id,
    });
  });
  return getEventLeague(ctx, row.id);
}

const locked = (message: string) => new AppError("MATCH_LOCKED", 409, message);

/** Records (or clears) the result of a match; in the bracket, the winner moves on. */
export async function recordMatch(ctx: AuthedCtx, matchId: string, input: RecordMatchData) {
  const found = await findMatchWithEvent(ctx.db, matchId);
  if (!found) throw notFound("Ce match n'existe pas.");
  const row = await findManageableEvent(ctx, found.eventId);
  const { match, tournament: t } = found;
  if (!match.entrantAId || !match.entrantBId) {
    throw new AppError(
      "MATCH_NOT_READY",
      409,
      "Les deux adversaires de ce match ne sont pas encore connus.",
    );
  }
  if (input.result === "draw" && match.phase !== "pool") {
    throw new AppError(
      "DRAW_NOT_ALLOWED",
      400,
      "Pas de match nul en phase finale : désigne un vainqueur.",
    );
  }
  const winnerId =
    input.result === "a" ? match.entrantAId : input.result === "b" ? match.entrantBId : null;
  const values = {
    winnerId,
    draw: input.result === "draw",
    scoreA: input.result === null ? null : input.scoreA,
    scoreB: input.result === null ? null : input.scoreB,
    // A result ends the match; clearing it does not restart it.
    startedAt: null,
    updatedBy: ctx.user.id,
  };

  await inTransaction(ctx.db, async (tx) => {
    const all = await findMatches(tx, t.id);
    if (match.phase === "pool") {
      if (t.status !== "pools" && t.format === "pools_bracket") {
        throw locked("L'arbre est tiré : les résultats de poule ne changent plus.");
      }
      await updateMatch(tx, match.id, values);
      if (t.format === "pools") {
        const done = all.every((m) =>
          m.id === match.id ? input.result !== null : m.draw || m.winnerId !== null,
        );
        await setTournamentStatus(tx, t.id, done ? "done" : "pools");
      }
    } else {
      const before = all.filter((m) => m.phase !== "pool").map(bracketMatch);
      const edited = bracketMatch({ ...match, winnerId });
      const after = propagate(before.map((b) => (sameSlot(match, b) ? edited : b)));
      if (voidedResults(before, after, edited) > 0) {
        throw locked("Le match suivant est déjà joué : corrige d'abord son résultat.");
      }
      await updateMatch(tx, match.id, values);
      for (const m of all.filter((r) => r.phase !== "pool" && r.id !== match.id)) {
        const next = after.find((b) => sameSlot(m, b));
        if (
          next &&
          (next.a !== m.entrantAId || next.b !== m.entrantBId || next.winner !== m.winnerId)
        ) {
          await updateMatch(tx, m.id, {
            entrantAId: next.a,
            entrantBId: next.b,
            winnerId: next.winner,
            ...(next.winner ? {} : { scoreA: null, scoreB: null }),
            // New opponents: the match has not started.
            ...(next.a !== m.entrantAId || next.b !== m.entrantBId ? { startedAt: null } : {}),
          });
        }
      }
      await setTournamentStatus(tx, t.id, isComplete([], after) ? "done" : "bracket");
    }
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "tournament_match.recorded",
      entity: "tournament_match",
      entityId: match.id,
      payload: { result: input.result, scoreA: values.scoreA, scoreB: values.scoreB },
    });
  });
  return getEventLeague(ctx, row.id);
}

/** Marks a match as being played now ("en cours" on the live screen), or not any more. */
export async function setMatchLive(ctx: AuthedCtx, matchId: string, live: boolean) {
  const found = await findMatchWithEvent(ctx.db, matchId);
  if (!found) throw notFound("Ce match n'existe pas.");
  const row = await findManageableEvent(ctx, found.eventId);
  const { match } = found;
  if (live && (!match.entrantAId || !match.entrantBId)) {
    throw new AppError(
      "MATCH_NOT_READY",
      409,
      "Les deux adversaires de ce match ne sont pas encore connus.",
    );
  }
  if (live && (match.winnerId || match.draw)) {
    throw locked("Ce match est déjà joué : efface d'abord son résultat.");
  }
  await updateMatch(ctx.db, match.id, {
    startedAt: live ? new Date() : null,
    updatedBy: ctx.user.id,
  });
  return getEventLeague(ctx, row.id);
}

/**
 * Validates the placements of a league event and writes its league points in the ledger:
 * participation for everyone checked in or placed, plus the place's points. A new validation
 * cancels the previous points of the event (reversal rows) before writing the new ones.
 */
export async function validateResults(
  ctx: AuthedCtx,
  eventId: string,
  input: ValidateLeagueResultsInput,
) {
  const row = await findManageableEvent(ctx, eventId);
  if (!row.leagueSportId) {
    throw new AppError(
      "NOT_A_LEAGUE_EVENT",
      409,
      "Cet événement ne compte pas pour la ligue : choisis d'abord son sport.",
    );
  }
  const year = await requireCurrentSchoolYear(ctx);
  const season = await seasonOf(ctx.db, year.id);
  const rewarded = season.placementPoints.length;
  if (input.placements.some((p) => p.place > rewarded)) {
    throw new AppError(
      "PLACE_OUT_OF_SCALE",
      400,
      `Seules les ${rewarded} premières places rapportent des points.`,
    );
  }
  const teamEvent = isTeamEvent(row);
  const notPlaying = () =>
    new AppError("NOT_A_PARTICIPANT", 422, "Un des classés n'est pas inscrit à cet événement.");
  let placements: {
    place: number;
    userId: string | null;
    teamId: string | null;
    userIds: string[];
  }[];
  if (teamEvent) {
    const teams = new Set((await findConfirmedTeams(ctx.db, row.id)).map((t) => t.teamId));
    if (input.placements.some((p) => !p.teamId || !teams.has(p.teamId))) throw notPlaying();
    const members = await findMembersOfTeams(
      ctx.db,
      input.placements.map((p) => p.teamId ?? ""),
    );
    placements = input.placements.map((p) => ({
      place: p.place,
      userId: null,
      teamId: p.teamId ?? null,
      userIds: members.filter((m) => m.teamId === p.teamId).map((m) => m.userId),
    }));
  } else {
    const users = new Set((await findConfirmedUsers(ctx.db, row.id)).map((u) => u.userId));
    if (input.placements.some((p) => !p.userId || !users.has(p.userId))) throw notPlaying();
    placements = input.placements.map((p) => ({
      place: p.place,
      userId: p.userId ?? null,
      teamId: null,
      userIds: p.userId ? [p.userId] : [],
    }));
  }
  const points = eventPoints(season, await findCheckedIn(ctx.db, row.id), placements);

  await inTransactionWithEffects(ctx.db, async (tx, defer) => {
    const previous = await findEventPointTotals(tx, row.id);
    await insertLeaguePoints(
      tx,
      previous
        .filter((p) => p.total !== 0)
        .map((p) => ({
          schoolYearId: p.schoolYearId,
          eventId: row.id,
          userId: p.userId,
          points: -p.total,
          reason: "reversal" as const,
          createdBy: ctx.user.id,
        })),
    );
    await insertLeaguePoints(
      tx,
      [...points].flatMap(([userId, p]) => [
        ...(p.participation > 0
          ? [
              {
                schoolYearId: year.id,
                eventId: row.id,
                userId,
                points: p.participation,
                reason: "participation" as const,
                createdBy: ctx.user.id,
              },
            ]
          : []),
        ...(p.placement > 0
          ? [
              {
                schoolYearId: year.id,
                eventId: row.id,
                userId,
                points: p.placement,
                reason: "placement" as const,
                place: p.place,
                createdBy: ctx.user.id,
              },
            ]
          : []),
      ]),
    );
    await replaceResults(
      tx,
      row.id,
      placements.map((p) => ({
        place: p.place,
        userId: p.userId,
        teamId: p.teamId,
        createdBy: ctx.user.id,
      })),
    );
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "league.results_validated",
      entity: "event",
      entityId: row.id,
      payload: {
        placements: input.placements,
        people: points.size,
        corrected: previous.length > 0,
      },
    });
    // After the commit: one notification per person who scored, grouped by identical text.
    defer(async () => {
      const groups = new Map<string, { points: number; place: number | null; userIds: string[] }>();
      for (const [userId, p] of points) {
        const total = p.participation + p.placement;
        if (total <= 0) continue;
        const key = `${total}-${p.place}`;
        const group = groups.get(key) ?? {
          points: total,
          place: p.placement > 0 ? p.place : null,
          userIds: [],
        };
        group.userIds.push(userId);
        groups.set(key, group);
      }
      for (const g of groups.values()) {
        await ctx.services.notifier.notifyUsers(
          g.userIds,
          leagueResultPush(row, g.points, g.place),
        );
      }
    });
  });
  return getEventLeague(ctx, row.id);
}
