import {
  type AttachmentDto,
  type CreateTransactionData,
  type EventBudgetDto,
  RECEIPT_MAX_BYTES,
  RECEIPTS_PER_TRANSACTION,
  type TransactionDetailDto,
  type TransactionDto,
  type TreasuryKind,
  type TreasurySummaryDto,
  type UpdateTransactionData,
} from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { parisDate } from "../../core/time";
import { inTransaction } from "../../core/tx";
import { type ReceiptStore, sniffReceiptType } from "../../lib/storage";
import { findVisibleEvent } from "../events";
import { avatarPath } from "../me";
import { requireCurrentSchoolYear } from "../school-years";
import {
  countAttachmentsForUpdate,
  deleteAttachment,
  deleteBudget,
  findAttachment,
  findAttachments,
  findBudget,
  findEventTotals,
  findTransaction,
  findTransactions,
  findYearTotals,
  insertAttachment,
  insertTransaction,
  isCurrentMember,
  type TransactionRow,
  updateTransaction as updateTransactionRow,
  upsertBudget,
} from "./treasury.repo";

/** Path on the web origin (the web relays receipts: the browser never calls the API). */
export const attachmentPath = (fileName: string) => `/manage/treasury/attachments/${fileName}`;

function toDto(row: TransactionRow): TransactionDto {
  const t = row.transaction;
  return {
    id: t.id,
    counterparty: t.counterparty,
    initiator:
      row.initiator?.id && row.initiator.name
        ? {
            id: row.initiator.id,
            name: row.initiator.name,
            avatarUrl: row.initiator.image ? avatarPath(row.initiator.image) : null,
          }
        : null,
    amountCents: t.amountCents,
    occurredOn: t.occurredOn,
    kind: t.kind,
    otherLabel: t.otherLabel,
    comment: t.comment,
    event: row.event?.id && row.event.title && row.event.slug ? row.event : null,
    receiptUrl: t.receiptUrl,
    attachmentCount: Number(row.attachmentCount),
    createdBy: row.createdBy,
    reversalOfId: t.reversalOfId,
    reversedById: row.reversedById,
    createdAt: t.createdAt.toISOString(),
  };
}

const notFound = () => new AppError("NOT_FOUND", 404, "Cette écriture n'existe pas.");

async function getRow(ctx: AuthedCtx, transactionId: string) {
  const row = await findTransaction(ctx.db, transactionId);
  if (!row) throw notFound();
  return row;
}

export async function getTransaction(
  ctx: AuthedCtx,
  transactionId: string,
): Promise<TransactionDetailDto> {
  const row = await getRow(ctx, transactionId);
  const attachments = await findAttachments(ctx.db, row.transaction.id);
  return {
    ...toDto(row),
    attachments: attachments.map(
      (a): AttachmentDto => ({
        id: a.id,
        name: a.originalName,
        contentType: a.contentType as AttachmentDto["contentType"],
        sizeBytes: a.sizeBytes,
        url: attachmentPath(a.fileName),
        createdAt: a.createdAt.toISOString(),
      }),
    ),
  };
}

export async function listTransactions(
  ctx: AuthedCtx,
  filter: { q?: string | undefined; kind?: TreasuryKind | undefined; eventId?: string | undefined },
) {
  const year = await requireCurrentSchoolYear(ctx);
  return (await findTransactions(ctx.db, year.id, filter)).map(toDto);
}

/** The initiator is a BDE member of the year. */
async function assertInitiator(ctx: AuthedCtx, userId: string | undefined) {
  if (userId && !(await isCurrentMember(ctx.db, userId))) {
    throw new AppError(
      "INITIATOR_NOT_MEMBER",
      422,
      "L'initiateur doit être membre du BDE cette année.",
    );
  }
}

/** Signed amount: a debit or an « other » entry going out is negative. */
export function signedAmount(
  input: Pick<CreateTransactionData, "amountCents" | "kind" | "direction">,
) {
  const out = input.kind === "debit" || (input.kind === "other" && input.direction === "out");
  return out ? -input.amountCents : input.amountCents;
}

export async function createTransaction(ctx: AuthedCtx, input: CreateTransactionData) {
  const year = await requireCurrentSchoolYear(ctx);
  if (input.eventId) await findVisibleEvent(ctx, input.eventId);
  await assertInitiator(ctx, input.initiatorUserId);
  const amountCents = signedAmount(input);
  const id = await inTransaction(ctx.db, async (tx) => {
    const created = await insertTransaction(tx, {
      schoolYearId: year.id,
      eventId: input.eventId,
      counterparty: input.counterparty,
      initiatorUserId: input.initiatorUserId,
      kind: input.kind,
      otherLabel: input.kind === "other" ? input.otherLabel : null,
      amountCents,
      occurredOn: input.occurredOn,
      comment: input.comment,
      createdBy: ctx.user.id,
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "treasury.created",
      entity: "treasury_transaction",
      entityId: created,
      payload: {
        amountCents,
        kind: input.kind,
        counterparty: input.counterparty,
        eventId: input.eventId,
      },
    });
    return created;
  });
  return getTransaction(ctx, id);
}

/** Everything but the amount, the kind and the direction (ledger). */
export async function updateTransaction(
  ctx: AuthedCtx,
  transactionId: string,
  input: UpdateTransactionData,
) {
  const row = await getRow(ctx, transactionId);
  if (input.otherLabel !== undefined && row.transaction.kind !== "other") {
    throw new AppError("VALIDATION_ERROR", 400, "Seule une écriture « Autre » a un nom de type.", {
      issues: [{ path: ["otherLabel"], message: "Seule une écriture « Autre » a un nom de type." }],
    });
  }
  if (input.eventId) await findVisibleEvent(ctx, input.eventId);
  await assertInitiator(ctx, input.initiatorUserId);
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
  const row = await getRow(ctx, transactionId);
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
      counterparty: `Annulation : ${t.counterparty}`.slice(0, 200),
      initiatorUserId: t.initiatorUserId,
      kind: t.kind,
      otherLabel: t.otherLabel,
      amountCents: -t.amountCents,
      occurredOn: parisDate(now),
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

// --- Receipts ---

/**
 * Adds a payment receipt (photo or PDF, recognised by its bytes) to an entry. The file is saved
 * first and removed again if the entry cannot take it.
 */
export async function addAttachment(
  ctx: AuthedCtx,
  receipts: ReceiptStore,
  transactionId: string,
  originalName: string,
  bytes: Uint8Array,
) {
  if (bytes.byteLength === 0 || bytes.byteLength > RECEIPT_MAX_BYTES) {
    throw new AppError("VALIDATION_ERROR", 400, "Un justificatif doit faire moins de 8 Mo.");
  }
  const type = sniffReceiptType(bytes);
  if (!type) {
    throw new AppError("VALIDATION_ERROR", 400, "Envoie une photo (JPEG, PNG, WebP) ou un PDF.");
  }
  const row = await getRow(ctx, transactionId);
  const fileName = await receipts.save(bytes, type);
  try {
    await inTransaction(ctx.db, async (tx) => {
      if ((await countAttachmentsForUpdate(tx, row.transaction.id)) >= RECEIPTS_PER_TRANSACTION) {
        throw new AppError(
          "TOO_MANY_ATTACHMENTS",
          422,
          `${RECEIPTS_PER_TRANSACTION} justificatifs au plus par écriture.`,
        );
      }
      const id = await insertAttachment(tx, {
        transactionId: row.transaction.id,
        fileName,
        originalName,
        contentType: type,
        sizeBytes: bytes.byteLength,
        uploadedBy: ctx.user.id,
      });
      await writeAudit(tx, {
        actorUserId: ctx.user.id,
        action: "treasury.attachment_added",
        entity: "treasury_transaction",
        entityId: row.transaction.id,
        payload: { attachmentId: id, name: originalName, contentType: type },
      });
    });
  } catch (error) {
    await receipts.remove(fileName);
    throw error;
  }
  return getTransaction(ctx, row.transaction.id);
}

export async function removeAttachment(
  ctx: AuthedCtx,
  receipts: ReceiptStore,
  attachmentId: string,
) {
  const attachment = await findAttachment(ctx.db, attachmentId);
  if (!attachment) throw new AppError("NOT_FOUND", 404, "Ce justificatif n'existe pas.");
  await inTransaction(ctx.db, async (tx) => {
    await deleteAttachment(tx, attachment.id);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "treasury.attachment_removed",
      entity: "treasury_transaction",
      entityId: attachment.transactionId,
      payload: { attachmentId: attachment.id, name: attachment.originalName },
    });
  });
  await receipts.remove(attachment.fileName);
  return getTransaction(ctx, attachment.transactionId);
}

// --- Budgets ---

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

/** Planned budget of an event against what was recorded for it. */
export async function getEventBudget(ctx: AuthedCtx, eventId: string): Promise<EventBudgetDto> {
  const event = await findVisibleEvent(ctx, eventId);
  const [budget, totals] = await Promise.all([
    findBudget(ctx.db, event.id),
    findEventTotals(ctx.db, event.id),
  ]);
  return {
    budgetCents: budget?.budgetCents ?? null,
    incomeCents: totals.income,
    expenseCents: totals.expense,
    balanceCents: totals.income + totals.expense,
  };
}

/** Year totals: income, expenses (negative) and balance. */
export async function getSummary(ctx: AuthedCtx): Promise<TreasurySummaryDto> {
  const year = await requireCurrentSchoolYear(ctx);
  const totals = await findYearTotals(ctx.db, year.id);
  return {
    schoolYear: year.label,
    incomeCents: totals.income,
    expenseCents: totals.expense,
    balanceCents: totals.income + totals.expense,
  };
}

// --- Read access for other modules (exports). No authorization here: callers check it. ---

export async function yearTransactions(ctx: AuthedCtx) {
  const year = await requireCurrentSchoolYear(ctx);
  return { year, rows: (await findTransactions(ctx.db, year.id, {})).map(toDto) };
}
