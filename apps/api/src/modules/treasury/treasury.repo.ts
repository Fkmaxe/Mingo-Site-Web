import type { TreasuryKind } from "@bde/shared";
import { and, asc, desc, eq, ilike, isNull, or, sql, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import {
  event,
  eventBudget,
  membership,
  schoolYear,
  treasuryAttachment,
  treasuryTransaction,
  user,
} from "../../db/schema";

const reversal = alias(treasuryTransaction, "reversal");
const creator = alias(user, "creator");
const initiator = alias(user, "initiator");

// Qualified by hand: Drizzle may write bare column names inside a sub-select.
const attachmentCount = sql<number>`(select count(*)::int from "treasury_attachment" a
  where a."transaction_id" = "treasury_transaction"."id")`;

const selection = {
  transaction: treasuryTransaction,
  event: { id: event.id, title: event.title, slug: event.slug },
  initiator: { id: initiator.id, name: initiator.name, image: initiator.image },
  createdBy: creator.name,
  reversedById: reversal.id,
  attachmentCount,
};

export type TransactionRow = NonNullable<Awaited<ReturnType<typeof findTransaction>>>;

function baseQuery(db: DbOrTx) {
  return db
    .select(selection)
    .from(treasuryTransaction)
    .leftJoin(event, eq(event.id, treasuryTransaction.eventId))
    .leftJoin(initiator, eq(initiator.id, treasuryTransaction.initiatorUserId))
    .leftJoin(creator, eq(creator.id, treasuryTransaction.createdBy))
    .leftJoin(reversal, eq(reversal.reversalOfId, treasuryTransaction.id));
}

export function findTransactions(
  db: DbOrTx,
  schoolYearId: string,
  filter: { q?: string | undefined; kind?: TreasuryKind | undefined; eventId?: string | undefined },
) {
  const like = filter.q ? `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  return baseQuery(db)
    .where(
      and(
        eq(treasuryTransaction.schoolYearId, schoolYearId),
        filter.eventId ? eq(treasuryTransaction.eventId, filter.eventId) : undefined,
        filter.kind ? eq(treasuryTransaction.kind, filter.kind) : undefined,
        like
          ? or(
              ilike(treasuryTransaction.counterparty, like),
              ilike(treasuryTransaction.otherLabel, like),
              ilike(treasuryTransaction.comment, like),
              ilike(initiator.name, like),
            )
          : undefined,
      ),
    )
    .orderBy(desc(treasuryTransaction.occurredOn), desc(treasuryTransaction.createdAt));
}

export async function findTransaction(db: DbOrTx, transactionId: string) {
  const [row] = await baseQuery(db).where(eq(treasuryTransaction.id, transactionId));
  return row;
}

export async function insertTransaction(
  db: DbOrTx,
  values: typeof treasuryTransaction.$inferInsert,
) {
  const [row] = await db
    .insert(treasuryTransaction)
    .values(values)
    .returning({ id: treasuryTransaction.id });
  if (!row) throw new Error("insertTransaction: aucune ligne");
  return row.id;
}

export async function updateTransaction(
  db: DbOrTx,
  transactionId: string,
  values: Patch<typeof treasuryTransaction.$inferInsert>,
) {
  const changes = compact(values);
  if (!changes) return;
  await db
    .update(treasuryTransaction)
    .set(changes)
    .where(eq(treasuryTransaction.id, transactionId));
}

/** Whether the user is a BDE member of the current school year (initiator of an entry). */
export async function isCurrentMember(db: DbOrTx, userId: string) {
  const [row] = await db
    .select({ id: membership.id })
    .from(membership)
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .where(
      and(
        eq(membership.userId, userId),
        eq(schoolYear.isCurrent, true),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
      ),
    )
    .limit(1);
  return row !== undefined;
}

// --- Attachments ---

export function findAttachments(db: DbOrTx, transactionId: string) {
  return db
    .select()
    .from(treasuryAttachment)
    .where(eq(treasuryAttachment.transactionId, transactionId))
    .orderBy(asc(treasuryAttachment.createdAt));
}

export async function findAttachment(db: DbOrTx, attachmentId: string) {
  const [row] = await db
    .select()
    .from(treasuryAttachment)
    .where(eq(treasuryAttachment.id, attachmentId));
  return row;
}

/** The attachments of an entry, locked: two uploads at once cannot both pass the limit. */
export async function countAttachmentsForUpdate(db: DbOrTx, transactionId: string) {
  await db
    .select({ id: treasuryTransaction.id })
    .from(treasuryTransaction)
    .where(eq(treasuryTransaction.id, transactionId))
    .for("update");
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(treasuryAttachment)
    .where(eq(treasuryAttachment.transactionId, transactionId));
  return row?.n ?? 0;
}

export async function insertAttachment(db: DbOrTx, values: typeof treasuryAttachment.$inferInsert) {
  const [row] = await db
    .insert(treasuryAttachment)
    .values(values)
    .returning({ id: treasuryAttachment.id });
  if (!row) throw new Error("insertAttachment: aucune ligne");
  return row.id;
}

export async function deleteAttachment(db: DbOrTx, attachmentId: string) {
  await db.delete(treasuryAttachment).where(eq(treasuryAttachment.id, attachmentId));
}

// --- Totals and budgets ---

// A reversal counts on the side of the entry it cancels (its amount has the opposite sign):
// cancelling an expense lowers the expenses, it is not an income.
const entrySign = sql`case when ${treasuryTransaction.reversalOfId} is null then sign(${treasuryTransaction.amountCents}) else -sign(${treasuryTransaction.amountCents}) end`;
const income = sum(
  sql`case when ${entrySign} > 0 then ${treasuryTransaction.amountCents} else 0 end`,
).mapWith(Number);
const expense = sum(
  sql`case when ${entrySign} < 0 then ${treasuryTransaction.amountCents} else 0 end`,
).mapWith(Number);

export async function findYearTotals(db: DbOrTx, schoolYearId: string) {
  const [row] = await db
    .select({ income, expense })
    .from(treasuryTransaction)
    .where(eq(treasuryTransaction.schoolYearId, schoolYearId));
  return { income: row?.income ?? 0, expense: row?.expense ?? 0 };
}

/** Income and expenses recorded for an event, whatever the school year. */
export async function findEventTotals(db: DbOrTx, eventId: string) {
  const [row] = await db
    .select({ income, expense })
    .from(treasuryTransaction)
    .where(eq(treasuryTransaction.eventId, eventId));
  return { income: row?.income ?? 0, expense: row?.expense ?? 0 };
}

export async function upsertBudget(db: DbOrTx, eventId: string, budgetCents: number, by: string) {
  await db
    .insert(eventBudget)
    .values({ eventId, budgetCents, updatedBy: by })
    .onConflictDoUpdate({ target: eventBudget.eventId, set: { budgetCents, updatedBy: by } });
}

export async function deleteBudget(db: DbOrTx, eventId: string) {
  await db.delete(eventBudget).where(eq(eventBudget.eventId, eventId));
}

export async function findBudget(db: DbOrTx, eventId: string) {
  const [row] = await db.select().from(eventBudget).where(eq(eventBudget.eventId, eventId));
  return row;
}
