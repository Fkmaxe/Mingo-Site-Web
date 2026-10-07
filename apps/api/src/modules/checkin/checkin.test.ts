import { CheckinCandidateDto, CheckinDto, CheckinStatsDto, TicketDto } from "@bde/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { type DomainEvents, on } from "../../core/events";
import { attendance } from "../../db/schema";
import { getTestDb } from "../../test/db";
import {
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

// Lets a test observe the domain event, or make a subscriber fail.
const subscriber = vi.fn<(payload: DomainEvents["checkin.recorded"]) => Promise<void>>();
on("checkin.recorded", (payload) => subscriber(payload));

beforeEach(async () => {
  subscriber.mockReset();
  subscriber.mockResolvedValue(undefined);
  await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
});

async function registeredStudent(eventId: string, name = "Jeanne Durand") {
  const student = await createUser({ name });
  const ticket = await readJson(
    await call("POST", `/v1/events/${eventId}/registrations`, student.id),
    TicketDto,
  );
  return { student, ticket };
}

const scan = (userId: string | null, eventId: string, body: unknown) =>
  call("POST", `/v1/events/${eventId}/checkin`, userId, body);

describe("POST /v1/events/:id/checkin", () => {
  it("checks a participant in by QR code, once", async () => {
    const event = await createEvent({ poleId: sport.id, openPointsValue: 2 });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const { student, ticket } = await registeredStudent(event.id);

    const res = await scan(lead.id, event.id, { qrToken: ticket.qrToken });
    expect(res.status).toBe(201);
    const checkin = await readJson(res, CheckinDto);
    expect(checkin).toMatchObject({
      kind: "participant",
      user: { id: student.id, name: "Jeanne Durand" },
    });

    expect(subscriber).toHaveBeenCalledOnce();
    expect(subscriber.mock.calls[0]?.[0]).toMatchObject({
      attendanceId: checkin.attendanceId,
      userId: student.id,
      actorUserId: lead.id,
      event: { id: event.id, openPointsValue: 2 },
    });

    const again = await scan(lead.id, event.id, { qrToken: ticket.qrToken });
    expect(again.status).toBe(409);
    const error = await readError(again);
    expect(error.code).toBe("ALREADY_CHECKED_IN");
    expect(error.message).toMatch(/^Jeanne Durand est déjà entré·e à \d{2}:\d{2}\.$/);
    expect(error.details).toMatchObject({ checkedInAt: checkin.checkedInAt });
    expect(subscriber).toHaveBeenCalledOnce();
  });

  it("checks a participant in manually by user id", async () => {
    const event = await createEvent({ poleId: sport.id });
    const board = await createPersona("board");
    const { student } = await registeredStudent(event.id);
    expect((await scan(board.id, event.id, { userId: student.id })).status).toBe(201);
  });

  it("records a single attendance under concurrent scans", async () => {
    const event = await createEvent({ poleId: sport.id });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const { ticket } = await registeredStudent(event.id);
    const results = await Promise.all(
      [1, 2, 3].map(() => scan(lead.id, event.id, { qrToken: ticket.qrToken })),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await getTestDb().select().from(attendance)).toHaveLength(1);
  });

  it("rejects unknown, foreign and cancelled tickets with 422", async () => {
    const event = await createEvent({ poleId: sport.id });
    const other = await createEvent({ poleId: sport.id });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const { ticket: foreign } = await registeredStudent(other.id);
    const { ticket: cancelled, student } = await registeredStudent(event.id, "Paul");
    await call("POST", `/v1/registrations/${cancelled.id}/cancel`, student.id);

    for (const [body, message] of [
      [{ qrToken: "unknown-token" }, "Billet inconnu."],
      [{ qrToken: foreign.qrToken }, "Ce billet est pour un autre événement."],
      [{ qrToken: cancelled.qrToken }, "L'inscription de Paul a été annulée."],
    ] as const) {
      const res = await scan(lead.id, event.id, body);
      expect(res.status).toBe(422);
      expect(await readError(res)).toMatchObject({ code: "TICKET_NOT_VALID", message });
    }
    expect(subscriber).not.toHaveBeenCalled();
  });

  it("refuses check-in on a cancelled event", async () => {
    const event = await createEvent({ poleId: sport.id });
    const board = await createPersona("board");
    const { ticket } = await registeredStudent(event.id);
    await call("POST", `/v1/events/${event.id}/cancel`, board.id);
    expect((await scan(board.id, event.id, { qrToken: ticket.qrToken })).status).toBe(409);
  });

  it("checks permissions: 401, student 403, lead of another pole 403", async () => {
    const event = await createEvent({ poleId: sport.id });
    const { student, ticket } = await registeredStudent(event.id);
    const otherLead = await createPersona("pole_lead", { poleId: com.id });
    expect((await scan(null, event.id, { qrToken: ticket.qrToken })).status).toBe(401);
    expect((await scan(student.id, event.id, { qrToken: ticket.qrToken })).status).toBe(403);
    expect((await scan(otherLead.id, event.id, { qrToken: ticket.qrToken })).status).toBe(403);
  });

  it("returns 400 on an empty body", async () => {
    const event = await createEvent({ poleId: sport.id });
    const board = await createPersona("board");
    expect((await scan(board.id, event.id, {})).status).toBe(400);
  });

  it("rolls the check-in back when a subscriber fails", async () => {
    const event = await createEvent({ poleId: sport.id });
    const board = await createPersona("board");
    const { ticket } = await registeredStudent(event.id);
    subscriber.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    expect((await scan(board.id, event.id, { qrToken: ticket.qrToken })).status).toBe(500);
    expect(await getTestDb().select().from(attendance)).toHaveLength(0);
    expect((await scan(board.id, event.id, { qrToken: ticket.qrToken })).status).toBe(201);
  });
});

describe("check-in search and stats", () => {
  it("finds confirmed registrants by partial name, case-insensitive", async () => {
    const event = await createEvent({ poleId: sport.id });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const { student: jeanne, ticket } = await registeredStudent(event.id, "Jeanne Durand");
    await registeredStudent(event.id, "Paul Martin");
    await scan(lead.id, event.id, { qrToken: ticket.qrToken });

    const res = await call("GET", `/v1/events/${event.id}/checkin/search?q=durAND`, lead.id);
    const candidates = await readJson(res, z.array(CheckinCandidateDto));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.user.id).toBe(jeanne.id);
    expect(candidates[0]?.checkedInAt).not.toBeNull();

    const wildcard = await call("GET", `/v1/events/${event.id}/checkin/search?q=%25%25`, lead.id);
    expect(await readJson(wildcard, z.array(CheckinCandidateDto))).toEqual([]);
    expect((await call("GET", `/v1/events/${event.id}/checkin/search?q=a`, lead.id)).status).toBe(
      400,
    );
  });

  it("counts confirmed registrants and entries", async () => {
    const event = await createEvent({ poleId: sport.id });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const { ticket } = await registeredStudent(event.id, "A");
    await registeredStudent(event.id, "B");
    await scan(lead.id, event.id, { qrToken: ticket.qrToken });
    const stats = await readJson(
      await call("GET", `/v1/events/${event.id}/checkin/stats`, lead.id),
      CheckinStatsDto,
    );
    expect(stats).toEqual({ confirmedCount: 2, checkedInCount: 1 });
  });
});

describe("waitlisted tickets", () => {
  it("are refused at the door", async () => {
    const event = await createEvent({ poleId: sport.id, capacity: 1 });
    const board = await createPersona("board");
    await registeredStudent(event.id, "Premier");
    const { ticket } = await registeredStudent(event.id, "Attente");
    const res = await scan(board.id, event.id, { qrToken: ticket.qrToken });
    expect(res.status).toBe(422);
    expect((await readError(res)).message).toBe(
      "Attente est sur liste d'attente, sans place confirmée.",
    );
  });
});
