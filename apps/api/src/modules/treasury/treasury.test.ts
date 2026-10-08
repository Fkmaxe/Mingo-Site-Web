import { TransactionDto, TreasurySummaryDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog } from "../../db/schema";
import { getTestDb } from "../../test/db";
import {
  createEvent,
  createMembership,
  createPersona,
  createPole,
  createSchoolYear,
  createUser,
} from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

let treasurer: { id: string };
let president: { id: string };
let poleId: string;

beforeEach(async () => {
  const year = await createSchoolYear({
    label: "2026-2027",
    startsOn: "2026-09-01",
    endsOn: "2027-08-31",
  });
  poleId = (await createPole()).id;
  treasurer = await createUser();
  await createMembership({
    userId: treasurer.id,
    schoolYearId: year.id,
    role: "board",
    boardPosition: "treasurer",
  });
  president = await createPersona("board");
});

const add = (userId: string, body: Record<string, unknown>) =>
  call("POST", "/v1/treasury/transactions", userId, { occurredOn: "2026-10-01", ...body });

describe("treasury", () => {
  it("is managed by the treasurer, read by the board, hidden from others", async () => {
    expect((await add(treasurer.id, { label: "Cotisations", amountCents: 50000 })).status).toBe(
      201,
    );
    expect((await add(president.id, { label: "X", amountCents: 100 })).status).toBe(403);
    expect((await call("GET", "/v1/treasury/transactions", president.id)).status).toBe(200);
    const lead = await createPersona("pole_lead", { poleId });
    expect((await call("GET", "/v1/treasury/summary", lead.id)).status).toBe(403);
  });

  it("rejects zero amounts and invalid receipt links", async () => {
    expect((await add(treasurer.id, { label: "X", amountCents: 0 })).status).toBe(400);
    expect(
      (await add(treasurer.id, { label: "X", amountCents: 1, receiptUrl: "pas un lien" })).status,
    ).toBe(400);
  });

  it("summarises the year and each event: planned budget vs actual", async () => {
    const gala = await createEvent({
      poleId,
      title: "Gala",
      startsAt: new Date("2026-12-12T19:00:00Z"),
      endsAt: new Date("2026-12-13T01:00:00Z"),
    });
    await call("PUT", `/v1/events/${gala.id}/budget`, treasurer.id, { budgetCents: 150000 });
    await add(treasurer.id, { label: "Salle", amountCents: -120000, eventId: gala.id });
    await add(treasurer.id, { label: "Entrées", amountCents: 90000, eventId: gala.id });
    await add(treasurer.id, { label: "Subvention école", amountCents: 200000 });

    const summary = await readJson(
      await call("GET", "/v1/treasury/summary", president.id),
      TreasurySummaryDto,
    );
    expect(summary).toMatchObject({
      incomeCents: 290000,
      expenseCents: -120000,
      balanceCents: 170000,
    });
    expect(summary.events).toEqual([
      expect.objectContaining({
        event: expect.objectContaining({ title: "Gala" }),
        budgetCents: 150000,
        incomeCents: 90000,
        expenseCents: -120000,
        balanceCents: -30000,
      }),
    ]);
    const forGala = await readJson(
      await call("GET", `/v1/treasury/transactions?eventId=${gala.id}`, treasurer.id),
      z.array(TransactionDto),
    );
    expect(forGala).toHaveLength(2);
  });

  it("never changes an amount: a mistake is reversed, once, and audited", async () => {
    const entry = await readJson(
      await add(treasurer.id, { label: "Achat boissons", amountCents: -4550 }),
      TransactionDto,
    );
    const ignored = await call("PATCH", `/v1/treasury/transactions/${entry.id}`, treasurer.id, {
      amountCents: -1,
    });
    expect((await readJson(ignored, TransactionDto)).amountCents).toBe(-4550);
    const relabelled = await call("PATCH", `/v1/treasury/transactions/${entry.id}`, treasurer.id, {
      receiptUrl: "https://drive.example/facture.pdf",
    });
    expect((await readJson(relabelled, TransactionDto)).receiptUrl).toBe(
      "https://drive.example/facture.pdf",
    );

    const reversal = await readJson(
      await call("POST", `/v1/treasury/transactions/${entry.id}/reverse`, treasurer.id),
      TransactionDto,
    );
    expect(reversal).toMatchObject({
      amountCents: 4550,
      label: "Annulation : Achat boissons",
      reversalOfId: entry.id,
    });
    const again = await call("POST", `/v1/treasury/transactions/${entry.id}/reverse`, treasurer.id);
    expect((await readError(again)).code).toBe("ALREADY_REVERSED");
    expect(
      (await call("POST", `/v1/treasury/transactions/${reversal.id}/reverse`, treasurer.id)).status,
    ).toBe(409);

    const summary = await readJson(
      await call("GET", "/v1/treasury/summary", treasurer.id),
      TreasurySummaryDto,
    );
    expect(summary.balanceCents).toBe(0);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "treasury.reversed"));
    expect(audit).toHaveLength(1);
  });

  it("exports the ledger as CSV for the board", async () => {
    await add(treasurer.id, { label: "Salle", amountCents: -12050 });
    const res = await call("GET", "/v1/exports/treasury.csv", president.id);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("2026-10-01;Salle;;-120,50;");
  });
});
