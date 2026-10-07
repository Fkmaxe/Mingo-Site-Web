import { ApiErrorBody, EventDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog, event } from "../../db/schema";
import { authHeaders } from "../../test/auth";
import { getTestDb } from "../../test/db";
import { createTestApp } from "../../test/env";
import { createEvent, createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readError, readJson } from "../../test/http";

const EventPage = z.object({ items: z.array(EventDto), nextCursor: z.string().nullable() });
type Pole = Awaited<ReturnType<typeof createPole>>;

let sport: Pole;
let com: Pole;

beforeEach(async () => {
  await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
});

async function as(userId: string | null) {
  return userId ? await authHeaders(userId) : new Headers();
}

async function get(path: string, userId: string | null = null) {
  return createTestApp().request(path, { headers: await as(userId) });
}

async function send(method: string, path: string, userId: string | null, body?: unknown) {
  const headers = await as(userId);
  headers.set("content-type", "application/json");
  return createTestApp().request(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function titles(res: Response) {
  return (await readJson(res, EventPage)).items.map((e) => e.title).sort();
}

const inDays = (days: number, hours = 0) =>
  new Date(Date.now() + days * 24 * 3600 * 1000 + hours * 3600 * 1000);

function validInput(poleId: string) {
  return {
    poleId,
    title: "Tournoi de foot",
    location: "Stade Charléty",
    startsAt: inDays(10).toISOString(),
    endsAt: inDays(10, 3).toISOString(),
    visibility: "students",
    capacity: 40,
    openPointsValue: 2,
  };
}

describe("GET /v1/events — visibility", () => {
  beforeEach(async () => {
    await createEvent({ poleId: sport.id, title: "Public", visibility: "public" });
    await createEvent({ poleId: sport.id, title: "Students", visibility: "students" });
    await createEvent({ poleId: sport.id, title: "Members", visibility: "members" });
    await createEvent({ poleId: sport.id, title: "Draft sport", status: "draft" });
    await createEvent({ poleId: com.id, title: "Draft com", status: "draft" });
    await createEvent({ poleId: sport.id, title: "Deleted", deletedAt: new Date() });
  });

  it("shows only public events to visitors", async () => {
    expect(await titles(await get("/v1/events"))).toEqual(["Public"]);
  });

  it("adds student events for a logged-in student", async () => {
    const student = await createPersona("student");
    expect(await titles(await get("/v1/events", student.id))).toEqual(["Public", "Students"]);
  });

  it("adds member events for a BDE member", async () => {
    const member = await createPersona("member", { poleId: com.id });
    expect(await titles(await get("/v1/events", member.id))).toEqual([
      "Members",
      "Public",
      "Students",
    ]);
  });

  it("shows a pole lead the drafts of their pole only", async () => {
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    expect(await titles(await get("/v1/events", lead.id))).toEqual([
      "Draft sport",
      "Members",
      "Public",
      "Students",
    ]);
  });

  it("shows the board every draft", async () => {
    const board = await createPersona("board");
    expect(await titles(await get("/v1/events", board.id))).toContain("Draft com");
  });

  it("lists only manageable events with manageable=true", async () => {
    const lead = await createPersona("pole_lead", { poleId: com.id });
    expect(await titles(await get("/v1/events?manageable=true", lead.id))).toEqual(["Draft com"]);
    const student = await createPersona("student");
    expect(await titles(await get("/v1/events?manageable=true", student.id))).toEqual([]);
  });
});

describe("GET /v1/events — scope and pagination", () => {
  it("separates upcoming and past events, in chronological order", async () => {
    await createEvent({
      poleId: sport.id,
      title: "B",
      visibility: "public",
      startsAt: inDays(2),
      endsAt: inDays(2, 2),
    });
    await createEvent({
      poleId: sport.id,
      title: "A",
      visibility: "public",
      startsAt: inDays(1),
      endsAt: inDays(1, 2),
    });
    await createEvent({
      poleId: sport.id,
      title: "Old",
      visibility: "public",
      startsAt: inDays(-3),
      endsAt: inDays(-3, 2),
    });
    await createEvent({
      poleId: sport.id,
      title: "Older",
      visibility: "public",
      startsAt: inDays(-9),
      endsAt: inDays(-9, 2),
    });

    const upcoming = await readJson(await get("/v1/events"), EventPage);
    expect(upcoming.items.map((e) => e.title)).toEqual(["A", "B"]);
    const past = await readJson(await get("/v1/events?scope=past"), EventPage);
    expect(past.items.map((e) => e.title)).toEqual(["Old", "Older"]);
  });

  it("paginates with an opaque cursor", async () => {
    for (let day = 1; day <= 5; day++) {
      await createEvent({
        poleId: sport.id,
        title: `E${day}`,
        visibility: "public",
        startsAt: inDays(day),
        endsAt: inDays(day, 1),
      });
    }
    const first = await readJson(await get("/v1/events?limit=2"), EventPage);
    expect(first.items.map((e) => e.title)).toEqual(["E1", "E2"]);
    expect(first.nextCursor).not.toBeNull();
    const second = await readJson(
      await get(`/v1/events?limit=2&cursor=${first.nextCursor}`),
      EventPage,
    );
    expect(second.items.map((e) => e.title)).toEqual(["E3", "E4"]);
    const third = await readJson(
      await get(`/v1/events?limit=2&cursor=${second.nextCursor}`),
      EventPage,
    );
    expect(third.items.map((e) => e.title)).toEqual(["E5"]);
    expect(third.nextCursor).toBeNull();
  });

  it("rejects a forged cursor and a limit above 100", async () => {
    expect((await get("/v1/events?cursor=nope")).status).toBe(400);
    expect((await get("/v1/events?limit=101")).status).toBe(400);
  });

  it("filters by pole", async () => {
    await createEvent({ poleId: sport.id, title: "Foot", visibility: "public" });
    await createEvent({ poleId: com.id, title: "Shooting", visibility: "public" });
    expect(await titles(await get(`/v1/events?poleId=${com.id}`))).toEqual(["Shooting"]);
  });
});

describe("GET /v1/events/:ref", () => {
  it("finds an event by slug or id", async () => {
    const created = await createEvent({ poleId: sport.id, slug: "gala", visibility: "public" });
    const bySlug = await readJson(await get("/v1/events/gala"), EventDto);
    expect(bySlug.id).toBe(created.id);
    expect(bySlug.pole).toEqual({ id: sport.id, slug: "sport", name: "Sport" });
    expect(bySlug.canManage).toBe(false);
    expect((await get(`/v1/events/${created.id}`)).status).toBe(200);
  });

  it("hides drafts and restricted events behind a 404", async () => {
    const draft = await createEvent({ poleId: sport.id, status: "draft" });
    const membersOnly = await createEvent({ poleId: sport.id, visibility: "members" });
    const student = await createPersona("student");
    expect((await get(`/v1/events/${draft.id}`, student.id)).status).toBe(404);
    expect((await get(`/v1/events/${membersOnly.id}`, student.id)).status).toBe(404);
    expect((await get("/v1/events/does-not-exist")).status).toBe(404);
  });

  it("tells a pole lead they can manage their pole's event", async () => {
    const created = await createEvent({ poleId: sport.id, status: "draft" });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const dto = await readJson(await get(`/v1/events/${created.id}`, lead.id), EventDto);
    expect(dto.canManage).toBe(true);
  });
});

describe("POST /v1/events", () => {
  it("returns 401 without a session", async () => {
    expect((await send("POST", "/v1/events", null, validInput(sport.id))).status).toBe(401);
  });

  it("returns 403 for a student", async () => {
    const student = await createPersona("student");
    const res = await send("POST", "/v1/events", student.id, validInput(sport.id));
    expect(res.status).toBe(403);
  });

  it("returns 403 for a pole lead of another pole", async () => {
    const lead = await createPersona("pole_lead", { poleId: com.id });
    const res = await send("POST", "/v1/events", lead.id, validInput(sport.id));
    expect(res.status).toBe(403);
    expect((await readError(res)).code).toBe("FORBIDDEN");
  });

  it("creates a draft for a pole lead of that pole, with a slug and an audit entry", async () => {
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const res = await send("POST", "/v1/events", lead.id, validInput(sport.id));
    expect(res.status).toBe(201);
    const created = await readJson(res, EventDto);
    expect(created).toMatchObject({
      title: "Tournoi de foot",
      slug: "tournoi-de-foot",
      status: "draft",
      capacity: 40,
      registrationDeadline: null,
      canManage: true,
    });
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, created.id));
    expect(audit.map((a) => a.action)).toEqual(["event.created"]);

    const again = await readJson(
      await send("POST", "/v1/events", lead.id, validInput(sport.id)),
      EventDto,
    );
    expect(again.slug).toMatch(/^tournoi-de-foot-[0-9a-f]{4}$/);
  });

  it("returns 400 with French messages on invalid data", async () => {
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const res = await send("POST", "/v1/events", lead.id, {
      ...validInput(sport.id),
      title: "",
      endsAt: inDays(9).toISOString(),
    });
    expect(res.status).toBe(400);
    const error = await readError(res);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(error.details)).toContain("La fin doit être après le début");
  });

  it("returns 404 for an unknown pole (board)", async () => {
    const board = await createPersona("board");
    const res = await send("POST", "/v1/events", board.id, {
      ...validInput(sport.id),
      poleId: "00000000-0000-4000-8000-000000000000",
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /v1/events/:id", () => {
  it("lets a pole lead edit their pole's event", async () => {
    const created = await createEvent({ poleId: sport.id });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const res = await send("PATCH", `/v1/events/${created.id}`, lead.id, {
      title: "Nouveau titre",
      capacity: null,
    });
    expect(res.status).toBe(200);
    expect(await readJson(res, EventDto)).toMatchObject({ title: "Nouveau titre", capacity: null });
  });

  it("refuses a pole lead on another pole's event (403) and hides other drafts (404)", async () => {
    const published = await createEvent({ poleId: com.id });
    const draft = await createEvent({ poleId: com.id, status: "draft" });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    expect(
      (await send("PATCH", `/v1/events/${published.id}`, lead.id, { title: "Hack" })).status,
    ).toBe(403);
    expect((await send("PATCH", `/v1/events/${draft.id}`, lead.id, { title: "Hack" })).status).toBe(
      404,
    );
  });

  it("checks dates against the stored values", async () => {
    const created = await createEvent({
      poleId: sport.id,
      startsAt: inDays(5),
      endsAt: inDays(5, 2),
    });
    const board = await createPersona("board");
    const res = await send("PATCH", `/v1/events/${created.id}`, board.id, {
      endsAt: inDays(4).toISOString(),
    });
    expect(res.status).toBe(400);
    expect((await readError(res)).message).toBe("La fin doit être après le début");
  });

  it("refuses to edit a cancelled event", async () => {
    const created = await createEvent({ poleId: sport.id, status: "cancelled" });
    const board = await createPersona("board");
    const res = await send("PATCH", `/v1/events/${created.id}`, board.id, { title: "Retour" });
    expect(res.status).toBe(409);
    expect((await readError(res)).code).toBe("INVALID_STATUS_TRANSITION");
  });
});

describe("publish, cancel and delete", () => {
  it("publishes a draft once", async () => {
    const created = await createEvent({ poleId: sport.id, status: "draft" });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const res = await send("POST", `/v1/events/${created.id}/publish`, lead.id);
    expect((await readJson(res, EventDto)).status).toBe("published");
    expect((await send("POST", `/v1/events/${created.id}/publish`, lead.id)).status).toBe(409);
  });

  it("cancels a published event and records it", async () => {
    const created = await createEvent({ poleId: sport.id });
    const board = await createPersona("board");
    const res = await send("POST", `/v1/events/${created.id}/cancel`, board.id);
    expect((await readJson(res, EventDto)).status).toBe("cancelled");
    expect((await send("POST", `/v1/events/${created.id}/cancel`, board.id)).status).toBe(409);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "event.cancelled"));
    expect(audit).toHaveLength(1);
  });

  it("soft-deletes a draft only", async () => {
    const draft = await createEvent({ poleId: sport.id, status: "draft" });
    const published = await createEvent({ poleId: sport.id });
    const lead = await createPersona("pole_lead", { poleId: sport.id });

    expect((await send("DELETE", `/v1/events/${draft.id}`, lead.id)).status).toBe(204);
    expect((await get(`/v1/events/${draft.id}`, lead.id)).status).toBe(404);
    const [row] = await getTestDb().select().from(event).where(eq(event.id, draft.id));
    expect(row?.deletedAt).not.toBeNull();

    const res = await send("DELETE", `/v1/events/${published.id}`, lead.id);
    expect(res.status).toBe(409);
  });

  it("refuses actions to a simple member", async () => {
    const created = await createEvent({ poleId: sport.id, status: "draft" });
    const member = await createPersona("member", { poleId: sport.id });
    for (const [method, path] of [
      ["POST", `/v1/events/${created.id}/publish`],
      ["DELETE", `/v1/events/${created.id}`],
    ] as const) {
      const res = await send(method, path, member.id);
      expect(res.status).toBe(403);
      expect(ApiErrorBody.parse(await res.json()).error.code).toBe("FORBIDDEN");
    }
  });
});
