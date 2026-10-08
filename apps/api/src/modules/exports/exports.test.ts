import { TicketDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { auditLog } from "../../db/schema";
import { getTestDb } from "../../test/db";
import {
  createEvent,
  createPersona,
  createPole,
  createSchoolYear,
  createUser,
} from "../../test/factories";
import { readJson } from "../../test/http";
import { call } from "../../test/request";

type Pole = Awaited<ReturnType<typeof createPole>>;
let sport: Pole;
let board: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await createSchoolYear({ label: "2026-2027" });
  sport = await createPole({ slug: "sport", name: "Sport" });
  board = await createPersona("board");
});

async function register(eventId: string, name: string, promo: string | null = null) {
  const student = await createUser({ name, promo });
  const ticket = await readJson(
    await call("POST", `/v1/events/${eventId}/registrations`, student.id),
    TicketDto,
  );
  return { student, ticket };
}

/** CSV body without BOM, split in rows of cells (no quoted separators in these fixtures). */
async function rows(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer());
  // UTF-8 BOM, so Excel reads accents. (Response.text() would silently strip it.)
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  return new TextDecoder()
    .decode(bytes)
    .trim()
    .split("\r\n")
    .map((line) => line.split(";"));
}

describe("GET /v1/events/:id/exports/registrations.csv", () => {
  it("exports registrants with their entry time, as a download, and audits it", async () => {
    const event = await createEvent({ poleId: sport.id, slug: "gala" });
    const { ticket } = await register(event.id, "Jeanne Durand", "3A");
    await register(event.id, "Alex Martin");
    await call("POST", `/v1/events/${event.id}/checkin`, board.id, { qrToken: ticket.qrToken });

    const res = await call("GET", `/v1/events/${event.id}/exports/registrations.csv`, board.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="inscrits-gala.csv"');
    const [header, alex, jeanne] = await rows(res);
    expect(header).toEqual(["Nom", "Email", "Promo", "Statut", "Inscrit le", "Entrée"]);
    expect(alex?.slice(0, 4)).toEqual([
      "Alex Martin",
      expect.stringContaining("@myskolae.fr"),
      "",
      "Inscrit",
    ]);
    expect(alex?.[5]).toBe("");
    expect(jeanne?.[2]).toBe("3A");
    expect(jeanne?.[5]).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);

    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "export.registrations"));
    expect(audit).toHaveLength(1);
  });

  it("adds the team column for a team event", async () => {
    const event = await createEvent({ poleId: sport.id, teamMinSize: 1, teamMaxSize: 4 });
    const captain = await createUser({ name: "Jeanne Durand" });
    await call("POST", `/v1/events/${event.id}/teams`, captain.id, { name: "Les Pingouins" });

    const res = await call("GET", `/v1/events/${event.id}/exports/registrations.csv`, board.id);
    const [header, jeanne] = await rows(res);
    expect(header?.slice(0, 5)).toEqual(["Nom", "Email", "Promo", "Équipe", "Statut"]);
    expect(jeanne?.[3]).toBe("Les Pingouins");
  });

  it("is reserved to the board", async () => {
    const event = await createEvent({ poleId: sport.id });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    expect(
      (await call("GET", `/v1/events/${event.id}/exports/registrations.csv`, lead.id)).status,
    ).toBe(403);
    expect((await call("GET", `/v1/events/${event.id}/exports/registrations.csv`)).status).toBe(
      401,
    );
  });
});

describe("GET /v1/events/:id/exports/attendance.csv", () => {
  it("lists who came, in arrival order", async () => {
    const event = await createEvent({ poleId: sport.id, slug: "foot" });
    const a = await register(event.id, "Premier");
    const b = await register(event.id, "Second");
    await register(event.id, "Absent");
    await call("POST", `/v1/events/${event.id}/checkin`, board.id, { qrToken: a.ticket.qrToken });
    await call("POST", `/v1/events/${event.id}/checkin`, board.id, { qrToken: b.ticket.qrToken });

    const res = await call("GET", `/v1/events/${event.id}/exports/attendance.csv`, board.id);
    const [, first, second, third] = await rows(res);
    expect([first?.[0], second?.[0], third]).toEqual(["Premier", "Second", undefined]);
    expect(first?.[3]).toBe("Participant");
  });
});

describe("GET /v1/exports/open-points.csv", () => {
  it("exports validated totals per student, or every movement", async () => {
    const jeanne = await createUser({ name: "Jeanne" });
    const paul = await createUser({ name: "Paul" });
    const adjust = (userId: string, delta: number) =>
      call("POST", "/v1/open-points/adjustments", board.id, { userId, delta, reason: "Bénévolat" });
    await adjust(jeanne.id, 3);
    await adjust(jeanne.id, -1);
    await adjust(paul.id, 2);
    const event = await createEvent({ poleId: sport.id, openPointsValue: 5 });
    const { ticket } = await register(event.id, "Pending Pierre");
    await call("POST", `/v1/events/${event.id}/checkin`, board.id, { qrToken: ticket.qrToken });

    const summary = await call("GET", "/v1/exports/open-points.csv", board.id);
    expect(summary.headers.get("content-disposition")).toContain("points-open-2026-2027-total.csv");
    const [header, ...lines] = await rows(summary);
    expect(header).toEqual(["Nom", "Email", "Promo", "Points validés"]);
    expect(lines.map((l) => [l[0], l[3]])).toEqual([
      ["Jeanne", "2"],
      ["Paul", "2"],
    ]);

    const detail = await rows(
      await call("GET", "/v1/exports/open-points.csv?view=detail", board.id),
    );
    expect(detail).toHaveLength(5);
    expect(detail.find((l) => l[0] === "Pending Pierre")?.[6]).toBe("En attente");
  });

  it("is reserved to the board", async () => {
    const student = await createPersona("student");
    expect((await call("GET", "/v1/exports/open-points.csv", student.id)).status).toBe(403);
  });
});
