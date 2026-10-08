import { EventStatsDto, MemberInvolvementDto, YearOverviewDto } from "@bde/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
  meeting,
  meetingAttendance,
  registration,
  staffAssignment,
  staffSlot,
} from "../../db/schema";
import { getTestDb } from "../../test/db";
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

type Pole = Awaited<ReturnType<typeof createPole>>;
let sport: Pole;
let com: Pole;

beforeEach(async () => {
  await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
});

const hours = (h: number) => new Date(Date.now() + h * 3600 * 1000);
let tokens = 0;

async function registerDirect(
  eventId: string,
  status: "confirmed" | "waitlisted" | "cancelled" = "confirmed",
) {
  const user = await createUser();
  tokens += 1;
  await getTestDb()
    .insert(registration)
    .values({
      eventId,
      userId: user.id,
      status,
      qrToken: `token-${tokens}-${user.id}`,
      waitlistPosition: status === "waitlisted" ? tokens : null,
      cancelledAt: status === "cancelled" ? new Date() : null,
    });
  return user;
}

/** A past event of the sport pole: 3 confirmed (2 came), 1 waitlisted, 1 cancelled. */
async function pastEvent(poleId = sport.id) {
  const event = await createEvent({
    poleId,
    capacity: 3,
    startsAt: hours(-3),
    endsAt: hours(-1),
  });
  const people = [await registerDirect(event.id), await registerDirect(event.id)];
  await registerDirect(event.id);
  await registerDirect(event.id, "waitlisted");
  await registerDirect(event.id, "cancelled");
  for (const p of people) await createAttendance({ eventId: event.id, userId: p.id });
  return event;
}

describe("GET /v1/events/:id/stats", () => {
  it("gives the figures of a past event to its pole lead", async () => {
    const event = await pastEvent();
    const slot = (
      await getTestDb()
        .insert(staffSlot)
        .values({
          eventId: event.id,
          label: "Bar",
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          capacity: 2,
        })
        .returning()
    )[0];
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const member = await createPersona("member", { poleId: sport.id });
    const [m] = await getTestDb().query.membership.findMany({
      where: (t, { eq }) => eq(t.userId, member.id),
    });
    if (!slot || !m) throw new Error("fixtures");
    await getTestDb()
      .insert(staffAssignment)
      .values({ staffSlotId: slot.id, membershipId: m.id, status: "validated" });
    await createAttendance({ eventId: event.id, userId: member.id, kind: "staff" });

    const res = await call("GET", `/v1/events/${event.id}/stats`, lead.id);
    expect(res.status).toBe(200);
    const stats = await readJson(res, EventStatsDto);
    expect(stats).toMatchObject({
      capacity: 3,
      started: true,
      registrations: { confirmed: 3, waitlisted: 1, cancelled: 1 },
      teams: null,
      checkedIn: 2,
      attendanceRate: 0.667,
      noShows: 1,
      staff: { slots: 1, places: 2, validated: 1, checkedIn: 1 },
      openPoints: { pending: 0, validated: 0, rejected: 0 },
    });
    expect(stats.registrationsByDay.reduce((n, d) => n + d.count, 0)).toBe(5);
  });

  it("does not compute attendance before the event", async () => {
    const event = await createEvent({ poleId: sport.id });
    await registerDirect(event.id);
    const board = await createPersona("board");
    const stats = await readJson(
      await call("GET", `/v1/events/${event.id}/stats`, board.id),
      EventStatsDto,
    );
    expect(stats).toMatchObject({ started: false, attendanceRate: null, noShows: null });
  });

  it("counts teams for a team event", async () => {
    const event = await createEvent({ poleId: sport.id, teamMinSize: 1, teamMaxSize: 3 });
    const captain = await createUser();
    await call("POST", `/v1/events/${event.id}/teams`, captain.id, { name: "Les Pingouins" });
    const board = await createPersona("board");
    const stats = await readJson(
      await call("GET", `/v1/events/${event.id}/stats`, board.id),
      EventStatsDto,
    );
    expect(stats.teams).toEqual({ confirmed: 1, waitlisted: 0 });
  });

  it("is forbidden to the lead of another pole and to students", async () => {
    const event = await pastEvent();
    const otherLead = await createPersona("pole_lead", { poleId: com.id });
    expect((await call("GET", `/v1/events/${event.id}/stats`, otherLead.id)).status).toBe(403);
    const student = await createPersona("student");
    expect((await call("GET", `/v1/events/${event.id}/stats`, student.id)).status).toBe(403);
    expect((await call("GET", `/v1/events/${event.id}/stats`, null)).status).toBe(401);
  });
});

describe("GET /v1/stats/overview", () => {
  it("sums up the year, by month and by pole", async () => {
    await pastEvent(sport.id);
    await pastEvent(com.id);
    await createEvent({ poleId: sport.id, status: "draft" });
    const board = await createPersona("board");
    const res = await call("GET", "/v1/stats/overview", board.id);
    expect(res.status).toBe(200);
    const overview = await readJson(res, YearOverviewDto);
    expect(overview).toMatchObject({
      schoolYear: { label: "2026-2027" },
      events: 2,
      registrations: 8,
      checkIns: 4,
      uniqueParticipants: 4,
      attendanceRate: 0.667,
    });
    expect(overview.byMonth.reduce((n, m) => n + m.events, 0)).toBe(2);
    expect(overview.byPole.map((p) => [p.pole.name, p.events, p.checkIns])).toEqual([
      ["Communication", 1, 2],
      ["Sport", 1, 2],
    ]);
  });

  it("is reserved to the board", async () => {
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    expect((await call("GET", "/v1/stats/overview", lead.id)).status).toBe(403);
  });

  it("reports a missing school year", async () => {
    const board = await createPersona("board");
    const res = await call(
      "GET",
      "/v1/stats/overview?schoolYearId=00000000-0000-4000-8000-000000000000",
      board.id,
    );
    expect(res.status).toBe(404);
    expect((await readError(res)).code).toBe("NOT_FOUND");
  });
});

describe("GET /v1/stats/members", () => {
  it("counts staff shifts and meetings per member and per pole", async () => {
    const board = await createPersona("board");
    const runner = await createPersona("member", { poleId: sport.id });
    const quiet = await createPersona("member", { poleId: sport.id });
    const event = await pastEvent();
    await createAttendance({ eventId: event.id, userId: runner.id, kind: "staff" });

    const db = getTestDb();
    const meetings = await db
      .insert(meeting)
      .values([
        { title: "AG", poleId: null, startsAt: hours(-48) },
        { title: "Réunion sport", poleId: sport.id, startsAt: hours(-24) },
        { title: "Réunion com", poleId: com.id, startsAt: hours(-24) },
        { title: "Plus tard", poleId: sport.id, startsAt: hours(48) },
      ])
      .returning();
    const [ag, sportMeeting] = meetings;
    if (!ag || !sportMeeting) throw new Error("fixtures");
    await db.insert(meetingAttendance).values([
      { meetingId: ag.id, userId: runner.id },
      { meetingId: sportMeeting.id, userId: runner.id },
    ]);

    const res = await call("GET", "/v1/stats/members", board.id);
    expect(res.status).toBe(200);
    const involvement = await readJson(res, MemberInvolvementDto);
    const of = (id: string) => involvement.members.find((m) => m.user.id === id);
    expect(of(runner.id)).toMatchObject({
      poles: ["Sport"],
      board: false,
      staffShifts: 1,
      meetingsAttended: 2,
      meetingsHeld: 2,
      meetingRate: 1,
    });
    expect(of(quiet.id)).toMatchObject({ staffShifts: 0, meetingsAttended: 0, meetingRate: 0 });
    expect(of(board.id)).toMatchObject({ board: true, poles: [], meetingsHeld: 1 });
    expect(involvement.byPole).toEqual([
      { pole: { id: sport.id, name: "Sport" }, members: 2, staffShifts: 1, meetingsAttended: 2 },
    ]);
  });

  it("is reserved to the board", async () => {
    const member = await createPersona("member", { poleId: sport.id });
    expect((await call("GET", "/v1/stats/members", member.id)).status).toBe(403);
  });
});
