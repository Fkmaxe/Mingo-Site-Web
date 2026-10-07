import { EventDto, RegistrantDto, TicketDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { registration } from "../../db/schema";
import { getTestDb } from "../../test/db";
import { createEvent, createPersona, createPole, createSchoolYear } from "../../test/factories";
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
const registerAs = (userId: string | null, eventId: string) =>
  call("POST", `/v1/events/${eventId}/registrations`, userId);

describe("POST /v1/events/:id/registrations", () => {
  it("returns 401 without a session", async () => {
    const event = await createEvent({ poleId: sport.id });
    expect((await registerAs(null, event.id)).status).toBe(401);
  });

  it("registers a student and returns a ticket with a random QR token", async () => {
    const event = await createEvent({ poleId: sport.id, capacity: 10 });
    const student = await createPersona("student");
    const res = await registerAs(student.id, event.id);
    expect(res.status).toBe(201);
    const ticket = await readJson(res, TicketDto);
    expect(ticket.status).toBe("confirmed");
    expect(ticket.qrToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ticket.event.id).toBe(event.id);

    const dto = await readJson(await call("GET", `/v1/events/${event.id}`, student.id), EventDto);
    expect(dto).toMatchObject({
      confirmedCount: 1,
      registrationState: "open",
      myRegistration: { id: ticket.id, status: "confirmed" },
    });
  });

  it("refuses a second registration", async () => {
    const event = await createEvent({ poleId: sport.id });
    const student = await createPersona("student");
    await registerAs(student.id, event.id);
    const res = await registerAs(student.id, event.id);
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("ALREADY_REGISTERED");
  });

  it("refuses when the event is full", async () => {
    const event = await createEvent({ poleId: sport.id, capacity: 1 });
    const [a, b] = await Promise.all([createPersona("student"), createPersona("student")]);
    expect((await registerAs(a.id, event.id)).status).toBe(201);
    const res = await registerAs(b.id, event.id);
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("EVENT_FULL");
    const dto = await readJson(await call("GET", `/v1/events/${event.id}`, b.id), EventDto);
    expect(dto.registrationState).toBe("full");
  });

  it("never exceeds the capacity under concurrent registrations", async () => {
    const event = await createEvent({ poleId: sport.id, capacity: 1 });
    const students = await Promise.all([1, 2, 3, 4].map(() => createPersona("student")));
    const statuses = await Promise.all(students.map((s) => registerAs(s.id, event.id)));
    expect(statuses.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
    const rows = await getTestDb()
      .select()
      .from(registration)
      .where(eq(registration.eventId, event.id));
    expect(rows).toHaveLength(1);
  });

  it("refuses after the deadline", async () => {
    const event = await createEvent({ poleId: sport.id, registrationDeadline: hours(-1) });
    const student = await createPersona("student");
    const res = await registerAs(student.id, event.id);
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("DEADLINE_PASSED");
  });

  it("refuses a cancelled event and hides drafts and members-only events", async () => {
    const cancelled = await createEvent({ poleId: sport.id, status: "cancelled" });
    const draft = await createEvent({ poleId: sport.id, status: "draft" });
    const membersOnly = await createEvent({ poleId: sport.id, visibility: "members" });
    const student = await createPersona("student");
    const res = await registerAs(student.id, cancelled.id);
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("REGISTRATION_CLOSED");
    expect((await registerAs(student.id, draft.id)).status).toBe(404);
    expect((await registerAs(student.id, membersOnly.id)).status).toBe(404);
  });

  it("lets a member register to a members-only event", async () => {
    const membersOnly = await createEvent({ poleId: sport.id, visibility: "members" });
    const member = await createPersona("member", { poleId: com.id });
    expect((await registerAs(member.id, membersOnly.id)).status).toBe(201);
  });
});

describe("POST /v1/registrations/:id/cancel", () => {
  it("cancels, frees the place, and re-registration reuses the ticket", async () => {
    const event = await createEvent({ poleId: sport.id, capacity: 1 });
    const [a, b] = await Promise.all([createPersona("student"), createPersona("student")]);
    const ticket = await readJson(await registerAs(a.id, event.id), TicketDto);

    const res = await call("POST", `/v1/registrations/${ticket.id}/cancel`, a.id);
    expect(res.status).toBe(200);
    const cancelled = await readJson(res, TicketDto);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).not.toBeNull();

    expect((await registerAs(b.id, event.id)).status).toBe(201);
    expect((await registerAs(a.id, event.id)).status).toBe(409);

    // b leaves: a can come back, with the same registration and QR token.
    const [bTicket] = await readJson(await call("GET", "/v1/me/tickets", b.id), z.array(TicketDto));
    await call("POST", `/v1/registrations/${bTicket?.id}/cancel`, b.id);
    const back = await readJson(await registerAs(a.id, event.id), TicketDto);
    expect(back.id).toBe(ticket.id);
    expect(back.qrToken).toBe(ticket.qrToken);
  });

  it("rejects a forged pagination cursor", async () => {
    const event = await createEvent({ poleId: sport.id });
    const board = await createPersona("board");
    const forged = Buffer.from(JSON.stringify({ c: "not a date", id: event.id })).toString(
      "base64url",
    );
    const res = await call(
      "GET",
      `/v1/events/${event.id}/registrations?cursor=${forged}`,
      board.id,
    );
    expect(res.status).toBe(400);
  });

  it("hides another user's registration", async () => {
    const event = await createEvent({ poleId: sport.id });
    const [a, b] = await Promise.all([createPersona("student"), createPersona("student")]);
    const ticket = await readJson(await registerAs(a.id, event.id), TicketDto);
    expect((await call("POST", `/v1/registrations/${ticket.id}/cancel`, b.id)).status).toBe(404);
    expect((await call("GET", `/v1/tickets/${ticket.id}`, b.id)).status).toBe(404);
  });

  it("refuses once the event has started", async () => {
    const event = await createEvent({ poleId: sport.id, startsAt: hours(-1), endsAt: hours(2) });
    const student = await createPersona("student");
    const ticket = await readJson(await registerAs(student.id, event.id), TicketDto);
    const res = await call("POST", `/v1/registrations/${ticket.id}/cancel`, student.id);
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("DEADLINE_PASSED");
  });
});

describe("GET /v1/me/tickets", () => {
  it("lists upcoming tickets, without cancelled ones", async () => {
    const soon = await createEvent({
      poleId: sport.id,
      title: "Bientôt",
      startsAt: hours(5),
      endsAt: hours(6),
    });
    const later = await createEvent({
      poleId: sport.id,
      title: "Plus tard",
      startsAt: hours(50),
      endsAt: hours(51),
    });
    const dropped = await createEvent({ poleId: sport.id, title: "Abandonné" });
    const student = await createPersona("student");
    await registerAs(student.id, later.id);
    await registerAs(student.id, soon.id);
    const droppedTicket = await readJson(await registerAs(student.id, dropped.id), TicketDto);
    await call("POST", `/v1/registrations/${droppedTicket.id}/cancel`, student.id);

    const tickets = await readJson(
      await call("GET", "/v1/me/tickets", student.id),
      z.array(TicketDto),
    );
    expect(tickets.map((t) => t.event.title)).toEqual(["Bientôt", "Plus tard"]);
    expect((await call("GET", "/v1/me/tickets")).status).toBe(401);
  });
});

describe("GET /v1/events/:id/registrations", () => {
  const Page = z.object({ items: z.array(RegistrantDto), nextCursor: z.string().nullable() });

  it("lists registrants to the pole lead, without QR tokens", async () => {
    const event = await createEvent({ poleId: sport.id });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const students = await Promise.all([1, 2, 3].map(() => createPersona("student")));
    for (const s of students) await registerAs(s.id, event.id);

    const res = await call("GET", `/v1/events/${event.id}/registrations?limit=2`, lead.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("qrToken");
    const first = Page.parse(body);
    expect(first.items).toHaveLength(2);
    const second = await readJson(
      await call(
        "GET",
        `/v1/events/${event.id}/registrations?limit=2&cursor=${first.nextCursor}`,
        lead.id,
      ),
      Page,
    );
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((r) => r.user.id).sort();
    expect(ids).toEqual(students.map((s) => s.id).sort());
  });

  it("refuses students (403) and leads of another pole (403)", async () => {
    const event = await createEvent({ poleId: sport.id });
    const student = await createPersona("student");
    const otherLead = await createPersona("pole_lead", { poleId: com.id });
    expect((await call("GET", `/v1/events/${event.id}/registrations`, student.id)).status).toBe(
      403,
    );
    expect((await call("GET", `/v1/events/${event.id}/registrations`, otherLead.id)).status).toBe(
      403,
    );
  });
});
