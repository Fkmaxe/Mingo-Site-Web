import {
  EventBudgetDto,
  TransactionDetailDto,
  TransactionDto,
  TreasurySummaryDto,
} from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog } from "../../db/schema";
import { authHeaders } from "../../test/auth";
import { getTestDb } from "../../test/db";
import { createTestApp, testReceipts } from "../../test/env";
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
let yearId: string;

beforeEach(async () => {
  const year = await createSchoolYear({
    label: "2026-2027",
    startsOn: "2026-09-01",
    endsOn: "2027-08-31",
  });
  yearId = year.id;
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

/** A debit by default: the treasurer bought something, on 1 October. */
const add = (userId: string, body: Record<string, unknown>) =>
  call("POST", "/v1/treasury/transactions", userId, {
    counterparty: "Metro",
    initiatorUserId: treasurer.id,
    amountCents: 1000,
    occurredOn: "2026-10-01",
    kind: "debit",
    ...body,
  });
const created = async (body: Record<string, unknown>) =>
  readJson(await add(treasurer.id, body), TransactionDetailDto);
const summary = async (userId: string) =>
  readJson(await call("GET", "/v1/treasury/summary", userId), TreasurySummaryDto);
const list = async (query = "") =>
  readJson(
    await call("GET", `/v1/treasury/transactions${query}`, president.id),
    z.array(TransactionDto),
  );

describe("treasury entries", () => {
  it("are managed by the treasurer, read by the board, hidden from others", async () => {
    expect((await add(treasurer.id, {})).status).toBe(201);
    expect((await add(president.id, {})).status).toBe(403);
    expect((await call("GET", "/v1/treasury/transactions", president.id)).status).toBe(200);
    const lead = await createPersona("pole_lead", { poleId });
    expect((await call("GET", "/v1/treasury/summary", lead.id)).status).toBe(403);
    expect((await call("GET", "/v1/treasury/summary", null)).status).toBe(401);
  });

  it("record a debit as money out and a credit as money in, with the initiator", async () => {
    const debit = await created({ counterparty: "Metro", amountCents: 4550, comment: "Boissons" });
    expect(debit).toMatchObject({
      counterparty: "Metro",
      kind: "debit",
      amountCents: -4550,
      comment: "Boissons",
      initiator: { id: treasurer.id },
      otherLabel: null,
      attachmentCount: 0,
      attachments: [],
    });
    const credit = await created({ counterparty: "ESGI", kind: "credit", amountCents: 200000 });
    expect(credit.amountCents).toBe(200000);
    expect(await summary(president.id)).toMatchObject({
      incomeCents: 200000,
      expenseCents: -4550,
      balanceCents: 195450,
    });
  });

  it("name an « other » entry and count it in or out", async () => {
    const out = await created({
      kind: "other",
      otherLabel: "Virement interne",
      direction: "out",
      amountCents: 3000,
    });
    expect(out).toMatchObject({
      kind: "other",
      otherLabel: "Virement interne",
      amountCents: -3000,
    });
    await created({
      kind: "other",
      otherLabel: "Remboursement",
      direction: "in",
      amountCents: 500,
    });
    expect(await summary(treasurer.id)).toMatchObject({
      incomeCents: 500,
      expenseCents: -3000,
      balanceCents: -2500,
    });

    const unnamed = await add(treasurer.id, { kind: "other", direction: "in" });
    expect(unnamed.status).toBe(400);
    const undirected = await add(treasurer.id, { kind: "other", otherLabel: "X" });
    expect(undirected.status).toBe(400);
  });

  it("refuse a zero or negative amount, a missing counterparty and an initiator outside the BDE", async () => {
    expect((await add(treasurer.id, { amountCents: 0 })).status).toBe(400);
    expect((await add(treasurer.id, { amountCents: -100 })).status).toBe(400);
    expect((await add(treasurer.id, { counterparty: " " })).status).toBe(400);
    const student = await createPersona("student");
    const res = await add(treasurer.id, { initiatorUserId: student.id });
    expect(res.status).toBe(422);
    expect((await readError(res)).code).toBe("INITIATOR_NOT_MEMBER");
  });

  it("are searched by counterparty, initiator or comment, and filtered by kind", async () => {
    const member = await createUser({ name: "Camille Durand" });
    await createMembership({ userId: member.id, schoolYearId: yearId, role: "member", poleId });
    await created({ counterparty: "Metro", comment: "Boissons du gala" });
    await created({ counterparty: "ESGI", kind: "credit", initiatorUserId: member.id });
    expect((await list("?q=metro")).map((t) => t.counterparty)).toEqual(["Metro"]);
    expect((await list("?q=gala")).map((t) => t.counterparty)).toEqual(["Metro"]);
    expect((await list("?q=camille")).map((t) => t.counterparty)).toEqual(["ESGI"]);
    expect((await list("?kind=credit")).map((t) => t.counterparty)).toEqual(["ESGI"]);
    expect(await list("?q=100%25")).toEqual([]);
  });

  it("never change an amount: the rest is corrected, a mistake is reversed once, all audited", async () => {
    const entry = await created({ counterparty: "Achat boissons", amountCents: 4550 });
    const corrected = await call("PATCH", `/v1/treasury/transactions/${entry.id}`, treasurer.id, {
      amountCents: 1,
      kind: "credit",
      counterparty: "Metro Paris",
      comment: "Soirée d'intégration",
      occurredOn: "2026-10-02",
    });
    expect(await readJson(corrected, TransactionDetailDto)).toMatchObject({
      amountCents: -4550,
      kind: "debit",
      counterparty: "Metro Paris",
      comment: "Soirée d'intégration",
      occurredOn: "2026-10-02",
    });
    const named = await call("PATCH", `/v1/treasury/transactions/${entry.id}`, treasurer.id, {
      otherLabel: "X",
    });
    expect(named.status).toBe(400);

    const reversal = await readJson(
      await call("POST", `/v1/treasury/transactions/${entry.id}/reverse`, treasurer.id),
      TransactionDetailDto,
    );
    expect(reversal).toMatchObject({
      amountCents: 4550,
      kind: "debit",
      counterparty: "Annulation : Metro Paris",
      reversalOfId: entry.id,
      initiator: { id: treasurer.id },
    });
    const again = await call("POST", `/v1/treasury/transactions/${entry.id}/reverse`, treasurer.id);
    expect((await readError(again)).code).toBe("ALREADY_REVERSED");
    expect(
      (await call("POST", `/v1/treasury/transactions/${reversal.id}/reverse`, treasurer.id)).status,
    ).toBe(409);

    expect((await summary(treasurer.id)).balanceCents).toBe(0);
    const actions = (await getTestDb().select().from(auditLog)).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(["treasury.created", "treasury.updated", "treasury.reversed"]),
    );
  });

  it("are read one by one with their details, 404 when unknown", async () => {
    const entry = await created({});
    const res = await call("GET", `/v1/treasury/transactions/${entry.id}`, president.id);
    expect((await readJson(res, TransactionDetailDto)).id).toBe(entry.id);
    const missing = await call(
      "GET",
      "/v1/treasury/transactions/00000000-0000-4000-8000-000000000000",
      president.id,
    );
    expect(missing.status).toBe(404);
  });
});

describe("receipts", () => {
  const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);

  async function upload(transactionId: string, bytes: Uint8Array, name = "facture.pdf") {
    const headers = await authHeaders(treasurer.id);
    headers.set("content-type", "application/pdf");
    return createTestApp().request(
      `/v1/treasury/transactions/${transactionId}/attachments?name=${encodeURIComponent(name)}`,
      { method: "POST", headers, body: bytes },
    );
  }

  it("accept photos and PDF, shown to the board, removed with an audit entry", async () => {
    const entry = await created({});
    const withPdf = await readJson(await upload(entry.id, PDF), TransactionDetailDto);
    const withPhoto = await readJson(
      await upload(entry.id, JPEG, "ticket.jpg"),
      TransactionDetailDto,
    );
    expect(withPhoto.attachments.map((a) => [a.name, a.contentType])).toEqual([
      ["facture.pdf", "application/pdf"],
      ["ticket.jpg", "image/jpeg"],
    ]);
    expect(withPdf.attachments[0]?.url).toMatch(
      /^\/manage\/treasury\/attachments\/[0-9a-f-]+\.pdf$/,
    );
    expect((await list()).find((t) => t.id === entry.id)?.attachmentCount).toBe(2);

    const fileName = withPdf.attachments[0]?.url.split("/").pop() ?? "";
    const served = await call("GET", `/v1/treasury/attachments/${fileName}`, president.id);
    expect(served.headers.get("content-type")).toBe("application/pdf");
    expect(served.headers.get("content-disposition")).toBe("inline");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PDF);
    const lead = await createPersona("pole_lead", { poleId });
    expect((await call("GET", `/v1/treasury/attachments/${fileName}`, lead.id)).status).toBe(403);

    const attachmentId = withPdf.attachments[0]?.id;
    expect(
      (await call("DELETE", `/v1/treasury/attachments/${attachmentId}`, president.id)).status,
    ).toBe(403);
    const after = await readJson(
      await call("DELETE", `/v1/treasury/attachments/${attachmentId}`, treasurer.id),
      TransactionDetailDto,
    );
    expect(after.attachments.map((a) => a.name)).toEqual(["ticket.jpg"]);
    expect(testReceipts.files.has(fileName)).toBe(false);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "treasury.attachment_removed"));
    expect(audit[0]?.payload).toMatchObject({ name: "facture.pdf" });
  });

  it("refuse what is neither a photo nor a PDF, whatever the announced type", async () => {
    const entry = await created({});
    const res = await upload(entry.id, new TextEncoder().encode("<html><script>"));
    expect(res.status).toBe(400);
  });

  it("refuse a file over 8 MB and an 11th receipt", async () => {
    const entry = await created({});
    const big = new Uint8Array(8 * 1024 * 1024 + 200 * 1024);
    big.set(PDF);
    expect([400, 413]).toContain((await upload(entry.id, big)).status);

    for (let i = 0; i < 10; i++) expect((await upload(entry.id, PDF)).status).toBe(201);
    const eleventh = await upload(entry.id, PDF);
    expect(eleventh.status).toBe(422);
    expect((await readError(eleventh)).code).toBe("TOO_MANY_ATTACHMENTS");
    expect(testReceipts.files.size).toBeGreaterThanOrEqual(10);
  });
});

describe("event budget", () => {
  it("compares the planned budget with the entries of the event", async () => {
    const gala = await createEvent({
      poleId,
      title: "Gala",
      startsAt: new Date("2026-12-12T19:00:00Z"),
      endsAt: new Date("2026-12-13T01:00:00Z"),
    });
    await call("PUT", `/v1/events/${gala.id}/budget`, treasurer.id, { budgetCents: 150000 });
    await created({ counterparty: "Salle", amountCents: 120000, eventId: gala.id });
    await created({
      counterparty: "Entrées",
      kind: "credit",
      amountCents: 90000,
      eventId: gala.id,
    });
    await created({ counterparty: "ESGI", kind: "credit", amountCents: 200000 });

    const budget = await readJson(
      await call("GET", `/v1/events/${gala.id}/budget`, president.id),
      EventBudgetDto,
    );
    expect(budget).toEqual({
      budgetCents: 150000,
      incomeCents: 90000,
      expenseCents: -120000,
      balanceCents: -30000,
    });
    expect((await list(`?eventId=${gala.id}`)).length).toBe(2);
    const lead = await createPersona("pole_lead", { poleId });
    expect((await call("GET", `/v1/events/${gala.id}/budget`, lead.id)).status).toBe(403);
  });
});

describe("export", () => {
  it("exports the ledger as CSV for the board", async () => {
    await created({ counterparty: "Salle", amountCents: 12050, comment: "Acompte" });
    const res = await call("GET", "/v1/exports/treasury.csv", president.id);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("2026-10-01;Salle;");
    const text = await (await call("GET", "/v1/exports/treasury.csv", president.id)).text();
    expect(text).toContain("Débit (sortie);;-120,50;Acompte;0;");
  });
});
