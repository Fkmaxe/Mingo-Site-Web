import type {
  CreateTransactionData,
  TransactionDto,
  TreasurySummaryDto,
  UpdateTransactionData,
} from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction } from "../../core/tx";
import { findVisibleEvent } from "../events";
import { requireCurrentSchoolYear, schoolYearById } from "../school-years";
import {
  deleteBudget,
  findBudget,
  findBudgetsBetween,
  findEventsByIds,
  findEventTotals,
  findTransaction,
  findTransactions,
  findYearTotals,
  insertTransaction,
  type TransactionRow,
  updateTransaction as updateTransactionRow,
  upsertBudget,
} from "./treasury.repo";

function toDto(row: TransactionRow): TransactionDto {
  const t = row.transaction;
  return {
    id: t.id,
    label: t.label,
    amountCents: t.amountCents,
    occurredOn: t.occurredOn,
    receiptUrl: t.receiptUrl,
    event: row.event?.id && row.event.title && row.event.slug ? row.event : null,
    createdBy: row.createdBy,
    reversalOfId: t.reversalOfId,
    reversedById: row.reversedById,
    createdAt: t.createdAt.toISOString(),
  };
}

const notFound = () => new AppError("NOT_FOUND", 404, "Cette écriture n'existe pas.");

async function getTransaction(ctx: AuthedCtx, transactionId: string) {
  const row = await findTransaction(ctx.db, transactionId);
  if (!row) throw notFound();
  return toDto(row);
}

export async function listTransactions(ctx: AuthedCtx, eventId: string | undefined) {
  const year = await requireCurrentSchoolYear(ctx);
  return (await findTransactions(ctx.db, year.id, eventId)).map(toDto);
}

export async function createTransaction(ctx: AuthedCtx, input: CreateTransactionData) {
  const year = await requireCurrentSchoolYear(ctx);
  if (input.eventId) await findVisibleEvent(ctx, input.eventId);
  const id = await inTransaction(ctx.db, async (tx) => {
    const created = await insertTransaction(tx, {
      ...input,
      schoolYearId: year.id,
      createdBy: ctx.user.id,
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "treasury.created",
      entity: "treasury_transaction",
      entityId: created,
      payload: { amountCents: input.amountCents, label: input.label, eventId: input.eventId },
    });
    return created;
  });
  return getTransaction(ctx, id);
}

/** Label, date and receipt only: amounts never change (ledger). */
export async function updateTransaction(
  ctx: AuthedCtx,
  transactionId: string,
  input: UpdateTransactionData,
) {
  const row = await findTransaction(ctx.db, transactionId);
  if (!row) throw notFound();
  await inTransaction(ctx.db, async (tx) => {
    await updateTransactionRow(tx, row.transaction.id, input);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "treasury.updated",
      entity: "treasury_transaction",
      entityId: row.transaction.id,
      payload: { fields: Object.keys(input) },
    });
  });
  return getTransaction(ctx, row.transaction.id);
}

/** Cancels an entry with an opposite one (a reversal cannot itself be reversed). */
export async function reverseTransaction(
  ctx: AuthedCtx,
  transactionId: string,
  now: Date = new Date(),
) {
  const row = await findTransaction(ctx.db, transactionId);
  if (!row) throw notFound();
  const t = row.transaction;
  if (row.reversedById || t.reversalOfId) {
    throw new AppError(
      "ALREADY_REVERSED",
      409,
      t.reversalOfId
        ? "Une annulation ne peut pas être annulée : saisis une nouvelle écriture."
        : "Cette écriture est déjà annulée.",
    );
  }
  const id = await inTransaction(ctx.db, async (tx) => {
    const created = await insertTransaction(tx, {
      schoolYearId: t.schoolYearId,
      eventId: t.eventId,
      label: `Annulation : ${t.label}`.slice(0, 200),
      amountCents: -t.amountCents,
      occurredOn: now.toISOString().slice(0, 10),
      reversalOfId: t.id,
      createdBy: ctx.user.id,
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "treasury.reversed",
      entity: "treasury_transaction",
      entityId: t.id,
      payload: { reversalId: created, amountCents: t.amountCents },
    });
    return created;
  });
  return getTransaction(ctx, id);
}

export async function setEventBudget(ctx: AuthedCtx, eventId: string, budgetCents: number | null) {
  const event = await findVisibleEvent(ctx, eventId);
  const before = await findBudget(ctx.db, event.id);
  await inTransaction(ctx.db, async (tx) => {
    if (budgetCents === null) await deleteBudget(tx, event.id);
    else await upsertBudget(tx, event.id, budgetCents, ctx.user.id);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "treasury.budget_set",
      entity: "event",
      entityId: event.id,
      payload: { before: before?.budgetCents ?? null, after: budgetCents },
    });
  });
  return { budgetCents };
}

/** Year totals, and for each event with a budget or entries: planned vs actual. */
export async function getSummary(ctx: AuthedCtx): Promise<TreasurySummaryDto> {
  const year = await requireCurrentSchoolYear(ctx);
  const dates = await schoolYearById(ctx, year.id);
  const [totals, perEvent, budgets] = await Promise.all([
    findYearTotals(ctx.db, year.id),
    findEventTotals(ctx.db, year.id),
    dates ? findBudgetsBetween(ctx.db, dates.startsOn, dates.endsOn) : Promise.resolve([]),
  ]);
  const ids = [
    ...new Set([
      ...perEvent.flatMap((e) => (e.eventId ? [e.eventId] : [])),
      ...budgets.map((b) => b.eventId),
    ]),
  ];
  const events = await findEventsByIds(ctx.db, ids);
  const budgetOf = new Map(budgets.map((b) => [b.eventId, b.budgetCents]));
  const totalsOf = new Map(perEvent.map((e) => [e.eventId, e]));
  return {
    schoolYear: year.label,
    incomeCents: totals.income,
    expenseCents: totals.expense,
    balanceCents: totals.income + totals.expense,
    events: events
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((e) => {
        const t = totalsOf.get(e.id);
        const incomeCents = t?.income ?? 0;
        const expenseCents = t?.expense ?? 0;
        return {
          event: { id: e.id, title: e.title, slug: e.slug, startsAt: e.startsAt.toISOString() },
          budgetCents: budgetOf.get(e.id) ?? null,
          incomeCents,
          expenseCents,
          balanceCents: incomeCents + expenseCents,
        };
      }),
  };
}

// --- Read access for other modules (exports). No authorization here: callers check it. ---

export async function yearTransactions(ctx: AuthedCtx) {
  const year = await requireCurrentSchoolYear(ctx);
  return { year, rows: (await findTransactions(ctx.db, year.id, undefined)).map(toDto) };
}
