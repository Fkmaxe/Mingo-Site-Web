import { EventDto, RegistrantDto, TeamDto, TicketDto } from "@bde/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createEvent, createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

type Pole = Awaited<ReturnType<typeof createPole>>;
let sport: Pole;

beforeEach(async () => {
  await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
});

const tournament = (overrides: Partial<Parameters<typeof createEvent>[0]> = {}) =>
  createEvent({ poleId: sport.id, teamMinSize: 2, teamMaxSize: 3, ...overrides });
const createTeam = (userId: string | null, eventId: string, body: unknown) =>
  call("POST", `/v1/events/${eventId}/teams`, userId, body);
const joinTeam = (userId: string | null, eventId: string, code: string) =>
  call("POST", `/v1/events/${eventId}/teams/join`, userId, { code });

async function teamOf(eventId: string, name = "Les Pingouins") {
  const captain = await createPersona("student");
  const team = await readJson(await createTeam(captain.id, eventId, { name }), TeamDto);
  return { captain, team };
}

describe("POST /v1/events/:id/teams", () => {
  it("returns 401 without a session", async () => {
    const event = await tournament();
    expect((await createTeam(null, event.id, { name: "Les Pingouins" })).status).toBe(401);
  });

  it("creates a team, registers its captain and gives a join code", async () => {
    const event = await tournament();
    const captain = await createPersona("student");
    const res = await createTeam(captain.id, event.id, { name: "  Les Pingouins " });
    expect(res.status).toBe(201);
    const team = await readJson(res, TeamDto);
    expect(team).toMatchObject({
      name: "Les Pingouins",
      captainId: captain.id,
      complete: false,
      members: [{ userId: captain.id, status: "confirmed" }],
    });
    expect(team.joinCode).toMatch(/^[A-Z0-9]{6}$/);

    const [ticket] = await readJson(
      await call("GET", "/v1/me/tickets", captain.id),
      z.array(TicketDto),
    );
    expect(ticket?.team).toEqual({ id: team.id, name: "Les Pingouins" });
  });

  it("validates the name", async () => {
    const event = await tournament();
    const captain = await createPersona("student");
    const res = await createTeam(captain.id, event.id, { name: "A" });
    expect(res.status).toBe(400);
    expect((await readError(res)).code).toBe("VALIDATION_ERROR");
  });

  it("refuses a name already taken in the event, whatever the case", async () => {
    const event = await tournament();
    await teamOf(event.id, "Les Pingouins");
    const other = await createPersona("student");
    const res = await createTeam(other.id, event.id, { name: "les pingouins" });
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("TEAM_NAME_TAKEN");
  });

  it("refuses an individual event", async () => {
    const event = await createEvent({ poleId: sport.id });
    const student = await createPersona("student");
    const res = await createTeam(student.id, event.id, { name: "Les Pingouins" });
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("NOT_TEAM_EVENT");
  });

  it("refuses someone already registered, without leaving an empty team", async () => {
    const event = await tournament();
    const { captain } = await teamOf(event.id);
    const res = await createTeam(captain.id, event.id, { name: "Deuxième équipe" });
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("ALREADY_REGISTERED");
    const board = await createPersona("board");
    const teams = await readJson(
      await call("GET", `/v1/events/${event.id}/teams`, board.id),
      z.array(TeamDto),
    );
    expect(teams.map((t) => t.name)).toEqual(["Les Pingouins"]);
  });

  it("refuses after the deadline", async () => {
    const event = await tournament({ registrationDeadline: new Date(Date.now() - 3600_000) });
    const student = await createPersona("student");
    const res = await createTeam(student.id, event.id, { name: "Les Pingouins" });
    expect((await readError(res)).code).toBe("DEADLINE_PASSED");
  });
});

describe("POST /v1/events/:id/registrations on a team event", () => {
  it("requires a team", async () => {
    const event = await tournament();
    const student = await createPersona("student");
    const res = await call("POST", `/v1/events/${event.id}/registrations`, student.id);
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("TEAM_REQUIRED");
  });
});

describe("POST /v1/events/:id/teams/join", () => {
  it("returns 401 without a session", async () => {
    const event = await tournament();
    expect((await joinTeam(null, event.id, "ABCDEF")).status).toBe(401);
  });

  it("joins a team with its code, case-insensitively, until it is complete", async () => {
    const event = await tournament();
    const { team } = await teamOf(event.id);
    const mate = await createPersona("student");
    const res = await joinTeam(mate.id, event.id, team.joinCode.toLowerCase());
    expect(res.status).toBe(201);
    const joined = await readJson(res, TeamDto);
    expect(joined.members.map((m) => m.userId)).toEqual([team.captainId, mate.id]);
    expect(joined.complete).toBe(true);
  });

  it("refuses a full team", async () => {
    const event = await tournament();
    const { team } = await teamOf(event.id);
    for (const _ of [1, 2]) {
      const mate = await createPersona("student");
      expect((await joinTeam(mate.id, event.id, team.joinCode)).status).toBe(201);
    }
    const late = await createPersona("student");
    const res = await joinTeam(late.id, event.id, team.joinCode);
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("TEAM_FULL");
  });

  it("does not find a team of another event", async () => {
    const event = await tournament();
    const other = await tournament();
    const { team } = await teamOf(other.id);
    const student = await createPersona("student");
    const res = await joinTeam(student.id, event.id, team.joinCode);
    expect(res.status).toBe(404);
  });

  it("validates the code", async () => {
    const event = await tournament();
    const student = await createPersona("student");
    expect((await joinTeam(student.id, event.id, "abc")).status).toBe(400);
  });

  it("refuses someone already registered", async () => {
    const event = await tournament();
    const { team, captain } = await teamOf(event.id);
    const res = await joinTeam(captain.id, event.id, team.joinCode);
    expect((await readError(res)).code).toBe("ALREADY_REGISTERED");
  });

  it("waitlists members once the event's capacity (in people) is reached", async () => {
    const event = await tournament({ capacity: 2 });
    const { team } = await teamOf(event.id);
    const second = await createPersona("student");
    const third = await createPersona("student");
    await joinTeam(second.id, event.id, team.joinCode);
    const joined = await readJson(await joinTeam(third.id, event.id, team.joinCode), TeamDto);
    expect(joined.members.map((m) => m.status)).toEqual(["confirmed", "confirmed", "waitlisted"]);
  });
});

describe("leaving a team", () => {
  it("passes the captaincy on, then deletes the empty team", async () => {
    const event = await tournament();
    const { team, captain } = await teamOf(event.id);
    const mate = await createPersona("student");
    await joinTeam(mate.id, event.id, team.joinCode);

    const [ticket] = await readJson(
      await call("GET", "/v1/me/tickets", captain.id),
      z.array(TicketDto),
    );
    await call("POST", `/v1/registrations/${ticket?.id}/cancel`, captain.id);
    const after = await readJson(
      await call("GET", `/v1/events/${event.id}/teams/mine`, mate.id),
      TeamDto,
    );
    expect(after).toMatchObject({ captainId: mate.id, complete: false });
    expect(after.members.map((m) => m.userId)).toEqual([mate.id]);
    expect((await call("GET", `/v1/events/${event.id}/teams/mine`, captain.id)).status).toBe(404);

    const [mateTicket] = await readJson(
      await call("GET", "/v1/me/tickets", mate.id),
      z.array(TicketDto),
    );
    await call("POST", `/v1/registrations/${mateTicket?.id}/cancel`, mate.id);
    // The name is free again.
    expect((await createTeam(captain.id, event.id, { name: "Les Pingouins" })).status).toBe(201);
  });
});

describe("GET /v1/events/:id/teams", () => {
  it("lists the teams for organisers, and the team on each registrant", async () => {
    const event = await tournament();
    await teamOf(event.id, "Zèbres");
    await teamOf(event.id, "Albatros");
    const board = await createPersona("board");
    const teams = await readJson(
      await call("GET", `/v1/events/${event.id}/teams`, board.id),
      z.array(TeamDto),
    );
    expect(teams.map((t) => t.name)).toEqual(["Albatros", "Zèbres"]);

    const registrants = await readJson(
      await call("GET", `/v1/events/${event.id}/registrations`, board.id),
      z.object({ items: z.array(RegistrantDto) }),
    );
    expect(registrants.items.map((r) => r.team).sort()).toEqual(["Albatros", "Zèbres"]);
  });

  it("is forbidden to students", async () => {
    const event = await tournament();
    const student = await createPersona("student");
    expect((await call("GET", `/v1/events/${event.id}/teams`, student.id)).status).toBe(403);
  });
});

describe("PATCH /v1/events/:id team sizes", () => {
  it("shows the sizes on the event", async () => {
    const event = await tournament();
    const student = await createPersona("student");
    const dto = await readJson(await call("GET", `/v1/events/${event.id}`, student.id), EventDto);
    expect(dto).toMatchObject({ teamMinSize: 2, teamMaxSize: 3 });
  });

  it("refuses a minimum above the stored maximum", async () => {
    const event = await tournament();
    const board = await createPersona("board");
    const res = await call("PATCH", `/v1/events/${event.id}`, board.id, { teamMinSize: 5 });
    expect(res.status).toBe(400);
  });

  it("refuses to switch to individual registrations once people are registered", async () => {
    const event = await tournament();
    await teamOf(event.id);
    const board = await createPersona("board");
    const res = await call("PATCH", `/v1/events/${event.id}`, board.id, {
      teamMinSize: null,
      teamMaxSize: null,
    });
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("TEAMS_LOCKED");
  });

  it("refuses a maximum below the largest team", async () => {
    const event = await tournament();
    const { team } = await teamOf(event.id);
    const mate = await createPersona("student");
    await joinTeam(mate.id, event.id, team.joinCode);
    const board = await createPersona("board");
    const refused = await call("PATCH", `/v1/events/${event.id}`, board.id, {
      teamMinSize: 1,
      teamMaxSize: 1,
    });
    expect((await readError(refused)).code).toBe("TEAMS_LOCKED");
    const ok = await call("PATCH", `/v1/events/${event.id}`, board.id, { teamMaxSize: 2 });
    expect(ok.status).toBe(200);
  });
});
