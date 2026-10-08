import { EventDto, RegistrantDto, TeamDto, TicketDto } from "@bde/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { testMailer } from "../../test/env";
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
      status: "confirmed",
      members: [{ userId: captain.id }],
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
});

describe("places per team", () => {
  const ticketsOf = async (userId: string) =>
    readJson(await call("GET", "/v1/me/tickets", userId), z.array(TicketDto));

  it("counts teams against the capacity, members follow their team", async () => {
    const event = await tournament({ capacity: 1 });
    const first = await teamOf(event.id, "Albatros");
    const second = await teamOf(event.id, "Zèbres");
    expect(first.team).toMatchObject({ status: "confirmed", waitlistPosition: null });
    expect(second.team).toMatchObject({ status: "waitlisted", waitlistPosition: 1 });

    // Joining a team with a place is confirmed even though the event is full.
    const mate = await createPersona("student");
    await joinTeam(mate.id, event.id, first.team.joinCode);
    expect((await ticketsOf(mate.id))[0]?.status).toBe("confirmed");
    // Joining a waitlisted team waits with it, at the team's rank.
    const waiting = await createPersona("student");
    await joinTeam(waiting.id, event.id, second.team.joinCode);
    expect((await ticketsOf(waiting.id))[0]).toMatchObject({
      status: "waitlisted",
      waitlistPosition: 1,
    });

    const dto = await readJson(await call("GET", `/v1/events/${event.id}`, mate.id), EventDto);
    expect(dto).toMatchObject({
      registrationState: "full",
      confirmedTeamCount: 1,
      waitlistTeamCount: 1,
      confirmedCount: 2,
      waitlistCount: 2,
    });
  });

  it("gives a freed place to the next team, with all its members, and mails them", async () => {
    const event = await tournament({ capacity: 1, title: "Tournoi" });
    const first = await teamOf(event.id, "Albatros");
    const second = await teamOf(event.id, "Zèbres");
    const mate = await createPersona("student");
    await joinTeam(mate.id, event.id, second.team.joinCode);

    // A member leaving does not free the team's place.
    const extra = await createPersona("student");
    await joinTeam(extra.id, event.id, first.team.joinCode);
    const [extraTicket] = await ticketsOf(extra.id);
    await call("POST", `/v1/registrations/${extraTicket?.id}/cancel`, extra.id);
    expect((await ticketsOf(mate.id))[0]?.status).toBe("waitlisted");

    const [captainTicket] = await ticketsOf(first.captain.id);
    await call("POST", `/v1/registrations/${captainTicket?.id}/cancel`, first.captain.id);
    const promoted = await readJson(
      await call("GET", `/v1/events/${event.id}/teams/mine`, mate.id),
      TeamDto,
    );
    expect(promoted).toMatchObject({ status: "confirmed", waitlistPosition: null });
    for (const userId of [second.captain.id, mate.id]) {
      expect((await ticketsOf(userId))[0]).toMatchObject({
        status: "confirmed",
        waitlistPosition: null,
      });
    }
    const subjects = testMailer.sent.map((m) => m.subject);
    expect(subjects.filter((s) => s.includes("Tournoi") && /place/i.test(s))).toHaveLength(2);
  });

  it("promotes waitlisted teams when the capacity grows, refuses it below the teams with a place", async () => {
    const event = await tournament({ capacity: 1 });
    await teamOf(event.id, "Albatros");
    const second = await teamOf(event.id, "Zèbres");
    const board = await createPersona("board");
    await call("PATCH", `/v1/events/${event.id}`, board.id, { capacity: 2 });
    expect(
      (
        await readJson(
          await call("GET", `/v1/events/${event.id}/teams/mine`, second.captain.id),
          TeamDto,
        )
      ).status,
    ).toBe("confirmed");

    const res = await call("PATCH", `/v1/events/${event.id}`, board.id, { capacity: 1 });
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("CAPACITY_BELOW_REGISTRATIONS");
  });

  it("never gives more team places than the capacity under concurrent creations", async () => {
    const event = await tournament({ capacity: 2 });
    const captains = await Promise.all([1, 2, 3, 4, 5].map(() => createPersona("student")));
    const teams = await Promise.all(
      captains.map(async (c, i) =>
        readJson(await createTeam(c.id, event.id, { name: `Équipe ${i}` }), TeamDto),
      ),
    );
    expect(teams.filter((t) => t.status === "confirmed")).toHaveLength(2);
    expect(
      teams
        .map((t) => t.waitlistPosition)
        .filter((p) => p !== null)
        .sort(),
    ).toEqual([1, 2, 3]);
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
