import { CalendarFeedDto, CalendarItemDto, PoleMemberDto } from "@bde/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createEvent, createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readJson } from "../../test/http";
import { call } from "../../test/request";

type Pole = Awaited<ReturnType<typeof createPole>>;
let sport: Pole;
let com: Pole;
let lead: { id: string };
let member: { id: string };

beforeEach(async () => {
  await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
  lead = await createPersona("pole_lead", { poleId: sport.id });
  member = await createPersona("member", { poleId: sport.id });
});

const at = (iso: string) => new Date(iso);
const calendar = async (userId: string, from = "2026-11-01", to = "2026-11-30") =>
  readJson(
    await call("GET", `/v1/me/calendar?from=${from}&to=${to}`, userId),
    z.array(CalendarItemDto),
  );

async function fixtures() {
  await createEvent({
    poleId: com.id,
    title: "Soirée d'intégration",
    startsAt: at("2026-11-12T19:00:00.000Z"),
    endsAt: at("2026-11-12T23:00:00.000Z"),
  });
  await createEvent({
    poleId: sport.id,
    title: "Brouillon",
    status: "draft",
    startsAt: at("2026-11-13T19:00:00.000Z"),
    endsAt: at("2026-11-13T21:00:00.000Z"),
  });
  await createEvent({
    poleId: sport.id,
    title: "Hors période",
    startsAt: at("2026-12-13T19:00:00.000Z"),
    endsAt: at("2026-12-13T21:00:00.000Z"),
  });
  await call("POST", "/v1/meetings", lead.id, {
    kind: "pole",
    poleId: sport.id,
    title: "Réunion sport",
    startsAt: "2026-11-05T17:00:00.000Z",
  });
  const board = await createPersona("board");
  await call("POST", "/v1/meetings", board.id, {
    kind: "board",
    poleId: null,
    title: "Bureau",
    startsAt: "2026-11-06T17:00:00.000Z",
  });
  const members = await readJson(
    await call("GET", `/v1/poles/${sport.id}/members`, lead.id),
    z.array(PoleMemberDto),
  );
  const mine = members.find((m) => m.user.id === member.id)?.membershipId;
  await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
    title: "Réserver le gymnase",
    dueOn: "2026-11-05",
    assigneeMembershipIds: [mine],
  });
  await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
    title: "Pas à moi",
    dueOn: "2026-11-05",
  });
}

describe("GET /v1/me/calendar", () => {
  it("shows every visible event, my meetings and my tasks with a deadline, by day", async () => {
    await fixtures();
    const items = await calendar(member.id);
    expect(items.map((i) => [i.day, i.kind, i.title, i.label])).toEqual([
      ["2026-11-05", "task", "Réserver le gymnase", "Tâche · Pôle Sport"],
      ["2026-11-05", "meeting", "Réunion sport", "Réunion · Pôle Sport"],
      ["2026-11-12", "event", "Soirée d'intégration", "Pôle Communication"],
    ]);
    expect(items[0]).toMatchObject({ allDay: true, startsAt: null });
    expect(items[2]?.path).toMatch(/^\/events\//);
  });

  it("is for members only, on a bounded range", async () => {
    const student = await createPersona("student");
    expect(
      (await call("GET", "/v1/me/calendar?from=2026-11-01&to=2026-11-30", student.id)).status,
    ).toBe(403);
    expect(
      (await call("GET", "/v1/me/calendar?from=2026-11-01&to=2027-03-01", member.id)).status,
    ).toBe(400);
    expect(
      (await call("GET", "/v1/me/calendar?from=2026-11-30&to=2026-11-01", member.id)).status,
    ).toBe(400);
    expect((await call("GET", "/v1/me/calendar?from=2026-11-01&to=2026-11-30", null)).status).toBe(
      401,
    );
  });
});

describe("iCal subscription", () => {
  const feed = async (userId: string, method = "GET") =>
    readJson(await call(method, "/v1/me/calendar/feed", userId), CalendarFeedDto);
  const tokenOf = (url: string | null) => url?.match(/\/calendar\/feed\/([\w-]+)\.ics$/)?.[1] ?? "";

  it("gives a private link read without a session, renewed or revoked by the member", async () => {
    await fixtures();
    expect((await feed(member.id)).url).toBeNull();
    const created = await feed(member.id, "POST");
    expect(created.url).toMatch(/^http:\/\/localhost:3000\/calendar\/feed\/[\w-]{43}\.ics$/);
    expect((await feed(member.id)).url).toBe(created.url);

    const res = await call("GET", `/v1/calendar/feeds/${tokenOf(created.url)}`, null);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    const ics = await res.text();
    expect(ics).toContain("SUMMARY:Tâche : Réserver le gymnase");
    expect(ics).toContain("SUMMARY:Réunion sport");
    expect(ics).not.toContain("Pas à moi");
    expect(ics).not.toContain("Brouillon");

    const renewed = await feed(member.id, "POST");
    expect(renewed.url).not.toBe(created.url);
    expect((await call("GET", `/v1/calendar/feeds/${tokenOf(created.url)}`, null)).status).toBe(
      404,
    );
    expect((await feed(member.id, "DELETE")).url).toBeNull();
    expect((await call("GET", `/v1/calendar/feeds/${tokenOf(renewed.url)}`, null)).status).toBe(
      404,
    );
    expect((await call("GET", "/v1/calendar/feeds/court", null)).status).toBe(400);
  });

  it("is for members only", async () => {
    const student = await createPersona("student");
    expect((await call("POST", "/v1/me/calendar/feed", student.id)).status).toBe(403);
  });
});
