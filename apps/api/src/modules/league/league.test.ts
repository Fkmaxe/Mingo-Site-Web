import { randomUUID } from "node:crypto";
import { EventLeagueDto, LeagueDto, MyLeagueDto, type TournamentMatchDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { auditLog, leaguePoints, registration, sport, team } from "../../db/schema";
import { getTestDb } from "../../test/db";
import { testPusher } from "../../test/env";
import {
  createAttendance,
  createEvent,
  createPersona,
  createPole,
  createSchoolYear,
  createUser,
} from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

type User = Awaited<ReturnType<typeof createUser>>;
type Event = Awaited<ReturnType<typeof createEvent>>;

let poleId: string;
let lead: User;
let board: User;
let student: User;
let sportId: string;

beforeEach(async () => {
  await createSchoolYear();
  poleId = (await createPole({ slug: "sport" })).id;
  lead = await createPersona("pole_lead", { poleId });
  board = await createPersona("board");
  student = await createUser();
  const [row] = await getTestDb().insert(sport).values({ name: "Badminton" }).returning();
  sportId = row?.id ?? "";
});

async function register(eventId: string, userId: string, teamId: string | null = null) {
  await getTestDb()
    .insert(registration)
    .values({ eventId, userId, status: "confirmed", qrToken: randomUUID(), teamId });
}

/** A league event with `n` registered players, all checked in, in registration order. */
async function leagueEvent(n: number, checkedIn = n) {
  const ev = await createEvent({ poleId, leagueSportId: sportId });
  const players: User[] = [];
  for (let i = 0; i < n; i++) {
    const u = await createUser({ name: `Joueur ${String(i + 1).padStart(2, "0")}` });
    await register(ev.id, u.id);
    if (i < checkedIn) await createAttendance({ eventId: ev.id, userId: u.id });
    players.push(u);
  }
  return { ev, players };
}

async function league(userId: string, res?: Response) {
  return readJson(res ?? (await call("GET", "/v1/league", userId)), LeagueDto);
}

async function eventLeague(ev: Event, userId = lead.id) {
  return readJson(await call("GET", `/v1/events/${ev.slug}/league`, userId), EventLeagueDto);
}

async function record(
  match: TournamentMatchDto,
  result: "a" | "b" | "draw" | null,
  scores?: [number, number],
) {
  return call("PUT", `/v1/tournament-matches/${match.id}`, lead.id, {
    result,
    ...(scores ? { scoreA: scores[0], scoreB: scores[1] } : {}),
  });
}

async function recordOk(
  match: TournamentMatchDto,
  result: "a" | "b" | "draw",
  scores?: [number, number],
) {
  const res = await record(match, result, scores);
  expect(res.status).toBe(200);
  return readJson(res, EventLeagueDto);
}

describe("GET /v1/league", () => {
  it("needs a session", async () => {
    expect((await call("GET", "/v1/league")).status).toBe(401);
  });

  it("returns the default season and the sports, empty standings", async () => {
    const dto = await league(student.id);
    expect(dto.season).toMatchObject({
      schoolYear: "2026-2027",
      name: "Ligue Sportive Interne",
      placementPoints: [10, 7, 5, 3, 2],
      participationPoints: 1,
    });
    expect(dto.sports).toEqual([{ id: sportId, name: "Badminton", eventCount: 0 }]);
    expect(dto.standings).toEqual([]);
    expect(dto.canManage).toBe(false);
    expect((await league(board.id)).canManage).toBe(true);
  });
});

describe("season settings and sports", () => {
  const settings = {
    name: "Ligue 2026-2027",
    prizes: "1er : PS5\n2e : Switch 2\n3e : carte Amazon 100 €",
    placementPoints: [12, 8, 5],
    participationPoints: 2,
  };

  it("are changed by the board only, and audited", async () => {
    expect((await call("PUT", "/v1/league", student.id, settings)).status).toBe(403);
    expect((await call("PUT", "/v1/league", lead.id, settings)).status).toBe(403);
    expect(
      (await call("PUT", "/v1/league", board.id, { ...settings, placementPoints: [] })).status,
    ).toBe(400);
    const dto = await league(board.id, await call("PUT", "/v1/league", board.id, settings));
    expect(dto.season).toMatchObject(settings);
    // Saved again: updated in place.
    await call("PUT", "/v1/league", board.id, { ...settings, participationPoints: 1 });
    expect((await league(student.id)).season.participationPoints).toBe(1);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "league_season.updated"));
    expect(audit).toHaveLength(2);
  });

  it("lets the board add and rename sports, names unique", async () => {
    const created = await league(
      board.id,
      await call("POST", "/v1/league/sports", board.id, { name: "Padel" }),
    );
    const padel = created.sports.find((s) => s.name === "Padel");
    expect(padel).toBeDefined();
    const dup = await call("POST", "/v1/league/sports", board.id, { name: "badminton" });
    expect(dup.status).toBe(409);
    expect((await readError(dup)).code).toBe("ALREADY_EXISTS");
    const renamed = await league(
      board.id,
      await call("PUT", `/v1/league/sports/${padel?.id}`, board.id, { name: "Padel 2v2" }),
    );
    expect(renamed.sports.map((s) => s.name)).toEqual(["Badminton", "Padel 2v2"]);
    expect((await call("POST", "/v1/league/sports", lead.id, { name: "Five" })).status).toBe(403);
    expect(
      (await call("PUT", `/v1/league/sports/${randomUUID()}`, board.id, { name: "Five" })).status,
    ).toBe(404);
  });
});

describe("PUT /v1/events/{id}/league", () => {
  it("lets the organisers choose the sport, or remove the event from the league", async () => {
    const ev = await createEvent({ poleId });
    const other = await createPersona("pole_lead", { poleId: (await createPole()).id });
    expect((await call("PUT", `/v1/events/${ev.id}/league`, other.id, { sportId })).status).toBe(
      403,
    );
    expect((await call("PUT", `/v1/events/${ev.id}/league`, student.id, { sportId })).status).toBe(
      403,
    );
    expect(
      (await call("PUT", `/v1/events/${ev.id}/league`, lead.id, { sportId: randomUUID() })).status,
    ).toBe(404);
    const set = await readJson(
      await call("PUT", `/v1/events/${ev.id}/league`, lead.id, { sportId }),
      EventLeagueDto,
    );
    expect(set.sport).toEqual({ id: sportId, name: "Badminton" });
    expect((await league(student.id)).sports[0]?.eventCount).toBe(1);
    const unset = await readJson(
      await call("PUT", `/v1/events/${ev.id}/league`, lead.id, { sportId: null }),
      EventLeagueDto,
    );
    expect(unset.sport).toBeNull();
  });
});

describe("GET /v1/events/{ref}/league", () => {
  it("shows the tournament to signed-in students, the candidates to organisers only", async () => {
    const { ev } = await leagueEvent(3);
    expect((await call("GET", `/v1/events/${ev.slug}/league`)).status).toBe(401);
    const asStudent = await eventLeague(ev, student.id);
    expect(asStudent).toMatchObject({
      canManage: false,
      candidates: [],
      sports: [],
      tournament: null,
    });
    const asLead = await eventLeague(ev);
    expect(asLead.canManage).toBe(true);
    expect(asLead.candidates.map((c) => c.name)).toEqual(["Joueur 01", "Joueur 02", "Joueur 03"]);
    expect(asLead.rewardedPlaces).toBe(5);
    expect(asLead.sports).toEqual([{ id: sportId, name: "Badminton" }]);
  });
});

describe("tournament", () => {
  it("is created by the organisers from the checked-in players, with pools drawn", async () => {
    const { ev } = await leagueEvent(9, 8);
    const input = {
      format: "pools_bracket",
      source: "checked_in",
      poolCount: 2,
      qualifiersPerPool: 2,
    };
    expect((await call("POST", `/v1/events/${ev.id}/tournament`, student.id, input)).status).toBe(
      403,
    );
    const res = await call("POST", `/v1/events/${ev.id}/tournament`, lead.id, input);
    expect(res.status).toBe(200);
    const t = (await readJson(res, EventLeagueDto)).tournament;
    expect(t?.entrants).toHaveLength(8);
    expect(t?.pools.map((p) => [p.name, p.standings.length, p.matches.length])).toEqual([
      ["Poule A", 4, 6],
      ["Poule B", 4, 6],
    ]);
    expect(t?.rounds).toEqual([]);
    const again = await call("POST", `/v1/events/${ev.id}/tournament`, lead.id, input);
    expect(again.status).toBe(409);
    expect((await readError(again)).code).toBe("TOURNAMENT_EXISTS");
  });

  it("refuses options that cannot work with the players", async () => {
    const { ev } = await leagueEvent(3);
    const res = await call("POST", `/v1/events/${ev.id}/tournament`, lead.id, {
      format: "pools",
      source: "registered",
      poolCount: 2,
    });
    expect(res.status).toBe(422);
    expect((await readError(res)).code).toBe("INVALID_TOURNAMENT");
    expect(
      (await call("POST", `/v1/events/${ev.id}/tournament`, lead.id, { format: "nope" })).status,
    ).toBe(400);
  });

  it("can be deleted and created again", async () => {
    const { ev } = await leagueEvent(4);
    await call("POST", `/v1/events/${ev.id}/tournament`, lead.id, {
      format: "bracket",
      source: "registered",
    });
    const deleted = await readJson(
      await call("DELETE", `/v1/events/${ev.id}/tournament`, lead.id),
      EventLeagueDto,
    );
    expect(deleted.tournament).toBeNull();
    expect((await call("DELETE", `/v1/events/${ev.id}/tournament`, lead.id)).status).toBe(404);
  });

  it("plays out: pools, crossed bracket, third-place match, then league points", async () => {
    const { ev, players } = await leagueEvent(8);
    const created = await readJson(
      await call("POST", `/v1/events/${ev.id}/tournament`, lead.id, {
        format: "pools_bracket",
        source: "checked_in",
        poolCount: 2,
        qualifiersPerPool: 2,
        thirdPlace: true,
      }),
      EventLeagueDto,
    );
    const early = await call("POST", `/v1/events/${ev.id}/tournament/bracket`, lead.id);
    expect(early.status).toBe(409);
    expect((await readError(early)).code).toBe("POOLS_NOT_FINISHED");

    // Better seed wins every pool match, 2-0 (A: 1 4 5 8, B: 2 3 6 7).
    const seed = new Map(created.tournament?.entrants.map((e) => [e.id, e.seed]));
    let dto = created;
    for (const pool of created.tournament?.pools ?? []) {
      for (const m of pool.matches) {
        const aBetter = (seed.get(m.a?.id ?? "") ?? 0) < (seed.get(m.b?.id ?? "") ?? 0);
        dto = await recordOk(m, aBetter ? "a" : "b", aBetter ? [2, 0] : [0, 2]);
      }
    }
    const tables = dto.tournament?.pools.map((p) => p.standings.map((s) => s.name));
    expect(tables).toEqual([
      ["Joueur 01", "Joueur 04", "Joueur 05", "Joueur 08"],
      ["Joueur 02", "Joueur 03", "Joueur 06", "Joueur 07"],
    ]);
    expect(dto.tournament?.pools[0]?.standings[0]).toMatchObject({
      points: 9,
      diff: 6,
      qualified: true,
    });

    dto = await readJson(
      await call("POST", `/v1/events/${ev.id}/tournament/bracket`, lead.id),
      EventLeagueDto,
    );
    // Pool matches are now locked.
    const poolMatch = dto.tournament?.pools[0]?.matches[0];
    if (!poolMatch) throw new Error("pool match");
    expect(poolMatch.editable).toBe(false);
    expect((await readError(await record(poolMatch, "b"))).code).toBe("MATCH_LOCKED");

    const [semi1, semi2] = dto.tournament?.rounds[0]?.matches ?? [];
    if (!semi1 || !semi2) throw new Error("semis");
    expect(dto.tournament?.rounds.map((r) => r.name)).toEqual(["Demi-finales", "Finale"]);
    expect([semi1.a?.name, semi1.b?.name, semi2.a?.name, semi2.b?.name]).toEqual([
      "Joueur 01",
      "Joueur 03",
      "Joueur 02",
      "Joueur 04",
    ]);
    const draw = await record(semi1, "draw");
    expect((await readError(draw)).code).toBe("DRAW_NOT_ALLOWED");
    const final0 = dto.tournament?.rounds[1]?.matches[0];
    if (!final0) throw new Error("final");
    expect((await readError(await record(final0, "a"))).code).toBe("MATCH_NOT_READY");

    dto = await recordOk(semi1, "a"); // 01
    dto = await recordOk(semi2, "b"); // 04
    const final = dto.tournament?.rounds[1]?.matches[0];
    const third = dto.tournament?.thirdPlaceMatch;
    if (!final || !third) throw new Error("final");
    expect([final.a?.name, final.b?.name, third.a?.name, third.b?.name]).toEqual([
      "Joueur 01",
      "Joueur 04",
      "Joueur 03",
      "Joueur 02",
    ]);
    dto = await recordOk(final, "b", [1, 3]); // 04 champion
    // The semi-final feeds a played final: locked.
    expect((await readError(await record(semi1, "b"))).code).toBe("MATCH_LOCKED");
    dto = await recordOk(third, "a"); // 03 third
    expect(dto.tournament?.status).toBe("done");
    const names = new Map(dto.tournament?.entrants.map((e) => [e.id, e.name]));
    const ranking = dto.tournament?.ranking.map((id) => names.get(id)) ?? [];
    // 5th: best record among the pool players out before the bracket (05, 3rd of pool A... and
    // 06, 3rd of pool B): same rank, same points; difference decides, then seed.
    expect(ranking.slice(0, 5)).toEqual([
      "Joueur 04",
      "Joueur 01",
      "Joueur 03",
      "Joueur 02",
      "Joueur 05",
    ]);

    // Validate the suggested top 5.
    const entrant = (name: string) => dto.tournament?.entrants.find((e) => e.name === name)?.userId;
    const top = ranking
      .slice(0, 5)
      .map((name, i) => ({ place: i + 1, userId: entrant(name ?? "") }));
    expect(
      (await call("POST", `/v1/events/${ev.id}/league/results`, student.id, { placements: top }))
        .status,
    ).toBe(403);
    const validated = await readJson(
      await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, { placements: top }),
      EventLeagueDto,
    );
    expect(validated.results?.placements.map((p) => [p.place, p.name])).toEqual([
      [1, "Joueur 04"],
      [2, "Joueur 01"],
      [3, "Joueur 03"],
      [4, "Joueur 02"],
      [5, "Joueur 05"],
    ]);
    const standings = (await league(student.id)).standings;
    expect(standings.map((s) => [s.rank, s.user.name, s.points, s.events])).toEqual([
      [1, "Joueur 04", 11, 1],
      [2, "Joueur 01", 8, 1],
      [3, "Joueur 03", 6, 1],
      [4, "Joueur 02", 4, 1],
      [5, "Joueur 05", 3, 1],
      [6, "Joueur 06", 1, 1],
      [6, "Joueur 07", 1, 1],
      [6, "Joueur 08", 1, 1],
    ]);
    const results = (await league(student.id)).events;
    expect(results).toEqual([
      expect.objectContaining({
        id: ev.id,
        sport: "Badminton",
        podium: [
          { place: 1, name: "Joueur 04" },
          { place: 2, name: "Joueur 01" },
          { place: 3, name: "Joueur 03" },
        ],
      }),
    ]);

    // Correction: 1st and 2nd swapped. Previous points cancelled, never updated.
    const swapped = [
      { place: 1, userId: players[0]?.id },
      { place: 2, userId: players[3]?.id },
    ];
    await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, { placements: swapped });
    const after = (await league(student.id)).standings;
    expect(after.slice(0, 3).map((s) => [s.user.name, s.points])).toEqual([
      ["Joueur 01", 11],
      ["Joueur 04", 8],
      ["Joueur 02", 1],
    ]);
    const ledger = await getTestDb()
      .select()
      .from(leaguePoints)
      .where(eq(leaguePoints.eventId, ev.id));
    expect(ledger.filter((l) => l.reason === "reversal")).toHaveLength(8);
    expect(ledger.reduce((sum, l) => sum + l.points, 0)).toBe(11 + 8 + 6 * 1);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "league.results_validated"));
    expect(audit).toHaveLength(2);
  });

  it("lets a bracket result be corrected while the next match is not played", async () => {
    const { ev } = await leagueEvent(4);
    let dto = await readJson(
      await call("POST", `/v1/events/${ev.id}/tournament`, lead.id, {
        format: "bracket",
        source: "registered",
        thirdPlace: false,
      }),
      EventLeagueDto,
    );
    const semi = dto.tournament?.rounds[0]?.matches[0];
    if (!semi) throw new Error("semi");
    dto = await recordOk(semi, "a");
    expect(dto.tournament?.rounds[1]?.matches[0]?.a?.name).toBe("Joueur 01");
    dto = await recordOk(semi, "b");
    expect(dto.tournament?.rounds[1]?.matches[0]?.a?.name).toBe("Joueur 04");
    const cleared = await readJson(await record(semi, null), EventLeagueDto);
    expect(cleared.tournament?.rounds[1]?.matches[0]?.a).toBeNull();
    expect(
      (
        await call("PUT", `/v1/tournament-matches/${semi.id}`, lead.id, {
          result: "a",
          scoreA: 0,
          scoreB: 2,
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("PUT", `/v1/tournament-matches/${randomUUID()}`, lead.id, { result: "a" }))
        .status,
    ).toBe(404);
  });

  it("ends a pools-only tournament when every match is played, draws allowed", async () => {
    const { ev } = await leagueEvent(3);
    let dto = await readJson(
      await call("POST", `/v1/events/${ev.id}/tournament`, lead.id, {
        format: "pools",
        source: "registered",
        poolCount: 1,
      }),
      EventLeagueDto,
    );
    const matches = dto.tournament?.pools[0]?.matches ?? [];
    expect(matches).toHaveLength(3);
    for (const m of matches) dto = await recordOk(m, "draw", [1, 1]);
    expect(dto.tournament?.status).toBe("done");
    expect(dto.tournament?.pools[0]?.standings.map((s) => s.points)).toEqual([2, 2, 2]);
  });
});

describe("POST /v1/events/{id}/league/results", () => {
  it("is refused for an event outside the league", async () => {
    const ev = await createEvent({ poleId });
    const res = await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, {
      placements: [],
    });
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("NOT_A_LEAGUE_EVENT");
  });

  it("refuses someone not registered, a place beyond the scale, the same place twice", async () => {
    const { ev, players } = await leagueEvent(2);
    const outsider = await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, {
      placements: [{ place: 1, userId: student.id }],
    });
    expect(outsider.status).toBe(422);
    expect((await readError(outsider)).code).toBe("NOT_A_PARTICIPANT");
    const far = await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, {
      placements: [{ place: 6, userId: players[0]?.id }],
    });
    expect((await readError(far)).code).toBe("PLACE_OUT_OF_SCALE");
    const twice = await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, {
      placements: [
        { place: 1, userId: players[0]?.id },
        { place: 1, userId: players[1]?.id },
      ],
    });
    expect(twice.status).toBe(400);
  });

  it("without a tournament: participation to everyone checked in, place to the placed", async () => {
    const { ev, players } = await leagueEvent(3, 2);
    await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, {
      placements: [{ place: 1, userId: players[2]?.id }],
    });
    const standings = (await league(student.id)).standings;
    // Joueur 03 was not checked in but was placed: counted as present.
    expect(standings.map((s) => [s.user.name, s.points])).toEqual([
      ["Joueur 03", 11],
      ["Joueur 01", 1],
      ["Joueur 02", 1],
    ]);
  });

  it("gives the points of a team's place to every member, and filters by class", async () => {
    const ev = await createEvent({
      poleId,
      leagueSportId: sportId,
      teamMinSize: 2,
      teamMaxSize: 3,
    });
    const teams: string[] = [];
    const members: User[] = [];
    for (const name of ["Les Flamants", "Les Requins"]) {
      const captain = await createUser({ name: `Capitaine ${name}` });
      const [row] = await getTestDb()
        .insert(team)
        .values({
          eventId: ev.id,
          name,
          joinCode: randomUUID().slice(0, 6).toUpperCase(),
          captainUserId: captain.id,
        })
        .returning();
      const teamId = row?.id ?? "";
      teams.push(teamId);
      const mate = await createUser({ name: `Équipier ${name}` });
      for (const u of [captain, mate]) {
        await register(ev.id, u.id, teamId);
        members.push(u);
      }
    }
    const asLead = await eventLeague(ev);
    expect(asLead.teamEvent).toBe(true);
    expect(asLead.candidates.map((c) => c.name)).toEqual(["Les Flamants", "Les Requins"]);
    const bracket = await readJson(
      await call("POST", `/v1/events/${ev.id}/tournament`, lead.id, {
        format: "bracket",
        source: "registered",
      }),
      EventLeagueDto,
    );
    expect(bracket.tournament?.entrants.map((e) => e.name)).toEqual([
      "Les Flamants",
      "Les Requins",
    ]);
    // A person instead of a team is refused for a team event.
    expect(
      (
        await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, {
          placements: [{ place: 1, userId: members[0]?.id }],
        })
      ).status,
    ).toBe(422);
    await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, {
      placements: [
        { place: 1, teamId: teams[1] },
        { place: 2, teamId: teams[0] },
      ],
    });
    const standings = (await league(student.id)).standings;
    expect(standings.map((s) => [s.rank, s.user.name, s.points])).toEqual([
      [1, "Capitaine Les Requins", 11],
      [1, "Équipier Les Requins", 11],
      [3, "Capitaine Les Flamants", 8],
      [3, "Équipier Les Flamants", 8],
    ]);
    expect(
      (
        await readJson(
          await call("GET", `/v1/league?levelId=${randomUUID()}`, student.id),
          LeagueDto,
        )
      ).standings,
    ).toEqual([]);
  });
});

describe("GET /v1/league/me", () => {
  it("gives the signed-in person's rank, points and events, with their team's place", async () => {
    const solo = await leagueEvent(3);
    await call("POST", `/v1/events/${solo.ev.id}/league/results`, lead.id, {
      placements: [
        { place: 1, userId: solo.players[1]?.id },
        { place: 2, userId: solo.players[0]?.id },
      ],
    });
    const ev = await createEvent({
      poleId,
      leagueSportId: sportId,
      teamMinSize: 1,
      teamMaxSize: 2,
    });
    const me = solo.players[0];
    if (!me) throw new Error("player");
    const [row] = await getTestDb()
      .insert(team)
      .values({ eventId: ev.id, name: "Les Flamants", joinCode: "FLAM01", captainUserId: me.id })
      .returning();
    await register(ev.id, me.id, row?.id ?? null);
    await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, {
      placements: [{ place: 1, teamId: row?.id }],
    });

    const mine = await readJson(await call("GET", "/v1/league/me", me.id), MyLeagueDto);
    expect(mine).toMatchObject({
      seasonName: "Ligue Sportive Interne",
      rank: 1,
      points: 19,
      ranked: 3,
    });
    expect(mine.events.map((e) => [e.id, e.points, e.place])).toEqual(
      expect.arrayContaining([
        [solo.ev.id, 8, 2],
        [ev.id, 11, 1],
      ]),
    );
    const nobody = await readJson(await call("GET", "/v1/league/me", student.id), MyLeagueDto);
    expect(nobody).toMatchObject({ rank: null, points: 0, ranked: 3, events: [] });
    expect((await call("GET", "/v1/league/me")).status).toBe(401);
  });
});

describe("league results notification", () => {
  it("tells each person who scored their points and place, after the commit", async () => {
    const { ev, players } = await leagueEvent(2);
    const [winner, other] = players;
    if (!winner || !other) throw new Error("players");
    const endpoints: string[] = [];
    for (const [i, u] of [winner, other].entries()) {
      const endpoint = `https://fcm.googleapis.com/fcm/send/league-${i}-${randomUUID()}`;
      endpoints.push(endpoint);
      await call("POST", "/v1/me/push/subscriptions", u.id, {
        endpoint,
        keys: { p256dh: "BPublicKeyOfTheBrowser", auth: "authSecret" },
        newEvents: false,
      });
    }
    await call("POST", `/v1/events/${ev.id}/league/results`, lead.id, {
      placements: [{ place: 1, userId: winner.id }],
    });
    const to = (endpoint: string | undefined) =>
      testPusher.sent.filter((s) => s.endpoint === endpoint).map((s) => s.message);
    expect(to(endpoints[0])).toEqual([
      {
        title: `Ligue : résultats de ${ev.title}`,
        body: "+11 points (1re place). Regarde ta place au classement.",
        url: "/ligue",
        tag: `league-${ev.slug}`,
      },
    ]);
    expect(to(endpoints[1])[0]?.body).toBe("+1 point. Regarde ta place au classement.");
  });
});
