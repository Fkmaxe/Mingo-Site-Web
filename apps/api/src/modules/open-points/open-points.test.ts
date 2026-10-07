import {
  DecideOpenPointsResultDto,
  LedgerEntryDto,
  MyOpenPointsDto,
  OpenPointsAccountDto,
  OpenPointsMovementDto,
  TicketDto,
} from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog, openPointsLedger, user } from "../../db/schema";
import { getTestDb } from "../../test/db";
import {
  createEvent,
  createPersona,
  createPole,
  createSchoolYear,
  createUser,
} from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { expectPgError, PG } from "../../test/pg";
import { call } from "../../test/request";

type Pole = Awaited<ReturnType<typeof createPole>>;
let sport: Pole;
let year: Awaited<ReturnType<typeof createSchoolYear>>;
let board: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  year = await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
  board = await createPersona("board");
});

/** Registers `userId` to a new event worth `points` and checks them in. */
async function attend(userId: string, points: number, title = "Tournoi") {
  const event = await createEvent({ poleId: sport.id, title, openPointsValue: points });
  const ticket = await readJson(
    await call("POST", `/v1/events/${event.id}/registrations`, userId),
    TicketDto,
  );
  const res = await call("POST", `/v1/events/${event.id}/checkin`, board.id, {
    qrToken: ticket.qrToken,
  });
  expect(res.status).toBe(201);
  return event;
}

const myPoints = async (userId: string) =>
  readJson(await call("GET", "/v1/me/open-points", userId), MyOpenPointsDto);
const ledger = async (query = "") =>
  readJson(
    await call("GET", `/v1/open-points${query}`, board.id),
    z.object({ items: z.array(LedgerEntryDto), nextCursor: z.string().nullable() }),
  );

describe("automatic movements on check-in", () => {
  it("gives a participant exactly one pending movement", async () => {
    const student = await createPersona("student");
    const event = await attend(student.id, 3, "Tournoi de foot");
    const mine = await myPoints(student.id);
    expect(mine).toMatchObject({ isMember: false, balance: 0, pending: 3 });
    expect(mine.movements).toEqual([
      expect.objectContaining({
        delta: 3,
        reason: "Participation : Tournoi de foot",
        source: "auto",
        status: "pending",
        event: { id: event.id, slug: event.slug, title: "Tournoi de foot" },
      }),
    ]);
    expect(await getTestDb().select().from(openPointsLedger)).toHaveLength(1);
  });

  it("never gives points to an active member", async () => {
    const member = await createPersona("member", { poleId: sport.id });
    await attend(member.id, 3);
    expect(await getTestDb().select().from(openPointsLedger)).toHaveLength(0);
    expect((await myPoints(member.id)).isMember).toBe(true);
  });

  it("creates nothing for an event worth no points", async () => {
    const student = await createPersona("student");
    await attend(student.id, 0);
    expect(await getTestDb().select().from(openPointsLedger)).toHaveLength(0);
  });
});

describe("validation by the board", () => {
  it("validates pending movements, counts them in the balance and audits", async () => {
    const student = await createPersona("student");
    await attend(student.id, 2, "A");
    await attend(student.id, 3, "B");
    const ids = (await ledger()).items.map((m) => m.id);
    expect(ids).toHaveLength(2);

    const res = await call("POST", "/v1/open-points/validate", board.id, {
      ids: [ids[0], ids[0], "00000000-0000-4000-8000-000000000000"],
    });
    expect(await readJson(res, DecideOpenPointsResultDto)).toEqual({ updated: 1, skipped: 1 });
    expect(await myPoints(student.id)).toMatchObject({ balance: 2, pending: 3 });

    const again = await call("POST", "/v1/open-points/validate", board.id, { ids: [ids[0]] });
    expect(await readJson(again, DecideOpenPointsResultDto)).toEqual({ updated: 0, skipped: 1 });

    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "open_points.validated"));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.payload).toEqual({ ids: [ids[0]] });
  });

  it("rejects movements: they never count", async () => {
    const student = await createPersona("student");
    await attend(student.id, 2);
    const [movement] = (await ledger()).items;
    await call("POST", "/v1/open-points/reject", board.id, { ids: [movement?.id] });
    expect(await myPoints(student.id)).toMatchObject({ balance: 0, pending: 0 });
    expect((await ledger("?status=rejected")).items).toHaveLength(1);
  });

  it("is reserved to the board", async () => {
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const student = await createPersona("student");
    for (const userId of [lead.id, student.id]) {
      expect((await call("GET", "/v1/open-points", userId)).status).toBe(403);
      expect(
        (await call("POST", "/v1/open-points/validate", userId, { ids: [board.id] })).status,
      ).toBe(403);
    }
    expect((await call("POST", "/v1/open-points/validate", board.id, { ids: [] })).status).toBe(
      400,
    );
  });

  it("filters by event and paginates", async () => {
    const students = await Promise.all([1, 2, 3].map(() => createPersona("student")));
    const event = await createEvent({ poleId: sport.id, openPointsValue: 1 });
    for (const s of students) {
      const ticket = await readJson(
        await call("POST", `/v1/events/${event.id}/registrations`, s.id),
        TicketDto,
      );
      await call("POST", `/v1/events/${event.id}/checkin`, board.id, { qrToken: ticket.qrToken });
    }
    await attend(students[0]?.id ?? "", 5, "Autre");

    const first = await ledger(`?eventId=${event.id}&limit=2`);
    expect(first.items).toHaveLength(2);
    const second = await ledger(`?eventId=${event.id}&limit=2&cursor=${first.nextCursor}`);
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });
});

describe("manual adjustments", () => {
  const adjust = (userId: string, body: unknown) =>
    call("POST", "/v1/open-points/adjustments", userId, body);

  it("requires a reason (422)", async () => {
    const student = await createPersona("student");
    for (const reason of ["", "   "]) {
      const res = await adjust(board.id, { userId: student.id, delta: 2, reason });
      expect(res.status).toBe(422);
      expect((await readError(res)).code).toBe("MANUAL_ADJUSTMENT_REQUIRES_REASON");
    }
    expect(await getTestDb().select().from(openPointsLedger)).toHaveLength(0);
  });

  it("records a validated movement, counted at once, and audits it", async () => {
    const student = await createPersona("student");
    const res = await adjust(board.id, {
      userId: student.id,
      delta: -1,
      reason: "  Correction d'un doublon ",
    });
    expect(res.status).toBe(201);
    expect(await readJson(res, OpenPointsMovementDto)).toMatchObject({
      delta: -1,
      reason: "Correction d'un doublon",
      source: "manual",
      status: "validated",
    });
    expect((await myPoints(student.id)).balance).toBe(-1);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "open_points.adjusted"));
    expect(audit[0]?.payload).toMatchObject({ userId: student.id, delta: -1 });
  });

  it("refuses members, zero deltas, unknown users and non-board users", async () => {
    const member = await createPersona("member", { poleId: sport.id });
    const lead = await createPersona("pole_lead", { poleId: sport.id });
    const student = await createPersona("student");
    const memberRes = await adjust(board.id, { userId: member.id, delta: 2, reason: "Bonus" });
    expect((await readError(memberRes)).code).toBe("MEMBERS_HAVE_NO_OPEN_POINTS");
    expect((await adjust(board.id, { userId: student.id, delta: 0, reason: "x" })).status).toBe(
      400,
    );
    expect(
      (
        await adjust(board.id, {
          userId: "00000000-0000-4000-8000-000000000000",
          delta: 1,
          reason: "x",
        })
      ).status,
    ).toBe(404);
    expect((await adjust(lead.id, { userId: student.id, delta: 1, reason: "x" })).status).toBe(403);
  });

  it("is also enforced by the database", async () => {
    const student = await createPersona("student");
    await expectPgError(
      getTestDb().insert(openPointsLedger).values({
        userId: student.id,
        schoolYearId: year.id,
        delta: 1,
        reason: " ",
        source: "manual",
      }),
      PG.CHECK_VIOLATION,
    );
  });
});

describe("GET /v1/open-points/accounts", () => {
  it("finds students with their balance and flags members", async () => {
    const student = await createUser({ name: "Jeanne Durand" });
    const member = await createPersona("member", { poleId: sport.id });
    await getTestDb().update(user).set({ name: "Paul Durand" }).where(eq(user.id, member.id));
    await call("POST", "/v1/open-points/adjustments", board.id, {
      userId: student.id,
      delta: 4,
      reason: "Bénévolat",
    });
    const accounts = await readJson(
      await call("GET", "/v1/open-points/accounts?q=durand", board.id),
      z.array(OpenPointsAccountDto),
    );
    expect(accounts.map((a) => [a.user.name, a.isMember, a.balance])).toEqual([
      ["Jeanne Durand", false, 4],
      ["Paul Durand", true, 0],
    ]);
  });
});
