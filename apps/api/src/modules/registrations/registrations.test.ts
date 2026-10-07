import { EventDto, RegistrantDto, TicketDto } from "@bde/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { testMailer } from "../../test/env";
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

  it("waitlists registrations once the event is full", async () => {
    const event = await createEvent({ poleId: sport.id, capacity: 1 });
    const a = await createPersona("student");
    const b = await createPersona("student");
    const c = await createPersona("student");
    expect((await readJson(await registerAs(a.id, event.id), TicketDto)).status).toBe("confirmed");
    const second = await readJson(await registerAs(b.id, event.id), TicketDto);
    const third = await readJson(await registerAs(c.id, event.id), TicketDto);
    expect([second.status, second.waitlistPosition]).toEqual(["waitlisted", 1]);
    expect([third.status, third.waitlistPosition]).toEqual(["waitlisted", 2]);

    const dto = await readJson(await call("GET", `/v1/events/${event.id}`, c.id), EventDto);
    expect(dto).toMatchObject({
      registrationState: "full",
      confirmedCount: 1,
      waitlistCount: 2,
      myRegistration: { status: "waitlisted", waitlistPosition: 2 },
    });
    const again = await registerAs(b.id, event.id);
    expect((await readError(again)).message).toBe(
      "Tu es déjà sur la liste d'attente de cet événement.",
    );
  });

  it("never exceeds the capacity under concurrent registrations", async () => {
    const event = await createEvent({ poleId: sport.id, capacity: 1 });
    const students = await Promise.all([1, 2, 3, 4].map(() => createPersona("student")));
    const tickets = await Promise.all(
      students.map(async (s) => readJson(await registerAs(s.id, event.id), TicketDto)),
    );
    expect(tickets.map((t) => t.status).sort()).toEqual([
      "confirmed",
      "waitlisted",
      "waitlisted",
      "waitlisted",
    ]);
    const positions = tickets.map((t) => t.waitlistPosition).filter((p) => p !== null);
    expect(positions.sort()).toEqual([1, 2, 3]);
  });

  it("mails a confirmation or the waitlist position", async () => {
    const event = await createEvent({ poleId: sport.id, title: "Gala", capacity: 1 });
    const a = await createUser({ email: "a@myskolae.fr" });
    const b = await createUser({ email: "b@myskolae.fr" });
    const ticket = await readJson(await registerAs(a.id, event.id), TicketDto);
    await registerAs(b.id, event.id);
    expect(testMailer.lastTo("a@myskolae.fr")?.subject).toBe("Inscription confirmée : Gala");
    expect(testMailer.lastTo("a@myskolae.fr")?.text).toContain(`/tickets/${ticket.id}`);
    expect(testMailer.lastTo("b@myskolae.fr")?.text).toContain("position 1");
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
  it("cancels, gives the place to the first waitlisted person and mails them", async () => {
    const event = await createEvent({ poleId: sport.id, title: "Gala", capacity: 1 });
    const a = await createUser();
    const b = await createUser({ email: "second@myskolae.fr" });
    const c = await createUser();
    const ticket = await readJson(await registerAs(a.id, event.id), TicketDto);
    const bTicket = await readJson(await registerAs(b.id, event.id), TicketDto);
    await registerAs(c.id, event.id);

    const res = await call("POST", `/v1/registrations/${ticket.id}/cancel`, a.id);
    expect(res.status).toBe(200);
    const cancelled = await readJson(res, TicketDto);
    expect([cancelled.status, cancelled.cancelledAt !== null]).toEqual(["cancelled", true]);

    const promoted = await readJson(
      await call("GET", `/v1/tickets/${bTicket.id}`, b.id),
      TicketDto,
    );
    expect([promoted.status, promoted.waitlistPosition]).toEqual(["confirmed", null]);
    expect(testMailer.lastTo("second@myskolae.fr")?.subject).toBe("Une place s'est libérée : Gala");
    const [cTicket] = await readJson(await call("GET", "/v1/me/tickets", c.id), z.array(TicketDto));
    expect(cTicket?.waitlistPosition).toBe(1);
  });

  it("re-registration after cancelling reuses the same registration and QR token", async () => {
    const event = await createEvent({ poleId: sport.id });
    const student = await createPersona("student");
    const ticket = await readJson(await registerAs(student.id, event.id), TicketDto);
    await call("POST", `/v1/registrations/${ticket.id}/cancel`, student.id);
    const back = await readJson(await registerAs(student.id, event.id), TicketDto);
    expect([back.id, back.qrToken, back.status]).toEqual([ticket.id, ticket.qrToken, "confirmed"]);
  });

  it("leaving the waitlist promotes nobody", async () => {
    const event = await createEvent({ poleId: sport.id, capacity: 1 });
    const a = await createPersona("student");
    const b = await createPersona("student");
    const c = await createPersona("student");
    await registerAs(a.id, event.id);
    const bTicket = await readJson(await registerAs(b.id, event.id), TicketDto);
    await registerAs(c.id, event.id);
    await call("POST", `/v1/registrations/${bTicket.id}/cancel`, b.id);
    const dto = await readJson(await call("GET", `/v1/events/${event.id}`, c.id), EventDto);
    expect(dto).toMatchObject({
      confirmedCount: 1,
      waitlistCount: 1,
      myRegistration: { waitlistPosition: 1 },
    });
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

describe("organiser changes", () => {
  it("raising the capacity promotes waitlisted people, in order", async () => {
    const event = await createEvent({ poleId: sport.id, capacity: 1 });
    const board = await createPersona("board");
    const students = await Promise.all([1, 2, 3].map(() => createPersona("student")));
    for (const s of students) await registerAs(s.id, event.id);

    const res = await call("PATCH", `/v1/events/${event.id}`, board.id, { capacity: 2 });
    expect(res.status).toBe(200);
    expect(await readJson(res, EventDto)).toMatchObject({ confirmedCount: 2, waitlistCount: 1 });
  });

  it("refuses a capacity below the confirmed registrations", async () => {
    const event = await createEvent({ poleId: sport.id, capacity: 5 });
    const board = await createPersona("board");
    const students = await Promise.all([1, 2, 3].map(() => createPersona("student")));
    for (const s of students) await registerAs(s.id, event.id);

    const res = await call("PATCH", `/v1/events/${event.id}`, board.id, {
      capacity: 2,
      title: "Nouveau titre",
    });
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("CAPACITY_BELOW_REGISTRATIONS");
    const dto = await readJson(await call("GET", `/v1/events/${event.id}`, board.id), EventDto);
    expect([dto.capacity, dto.title]).toEqual([5, event.title]);
  });

  it("mails confirmed and waitlisted people when the event is cancelled", async () => {
    const event = await createEvent({ poleId: sport.id, title: "Gala", capacity: 1 });
    const board = await createPersona("board");
    const a = await createUser({ email: "a@myskolae.fr" });
    const b = await createUser({ email: "b@myskolae.fr" });
    const c = await createUser({ email: "c@myskolae.fr" });
    await registerAs(a.id, event.id);
    await registerAs(b.id, event.id);
    const cTicket = await readJson(await registerAs(c.id, event.id), TicketDto);
    await call("POST", `/v1/registrations/${cTicket.id}/cancel`, c.id);
    testMailer.sent.length = 0;

    await call("POST", `/v1/events/${event.id}/cancel`, board.id);
    expect(testMailer.sent.map((m) => m.to).sort()).toEqual(["a@myskolae.fr", "b@myskolae.fr"]);
    expect(testMailer.sent[0]?.subject).toBe("Événement annulé : Gala");
  });
});
