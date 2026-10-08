import { and, desc, eq, inArray, isNotNull, sql, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import { event, eventBudget, treasuryTransaction, user } from "../../db/schema";

const reversal = alias(treasuryTransaction, "reversal");

const selection = {
  transaction: treasuryTransaction,
  event: { id: event.id, title: event.title, slug: event.slug },
  createdBy: user.name,
  reversedById: reversal.id,
};

export type TransactionRow = NonNullable<Awaited<ReturnType<typeof findTransaction>>>;

function baseQuery(db: DbOrTx) {
  return db
    .select(selection)
    .from(treasuryTransaction)
    .leftJoin(event, eq(event.id, treasuryTransaction.eventId))
    .leftJoin(user, eq(user.id, treasuryTransaction.createdBy))
    .leftJoin(reversal, eq(reversal.reversalOfId, treasuryTransaction.id));
}

export function findTransactions(db: DbOrTx, schoolYearId: string, eventId: string | undefined) {
  return baseQuery(db)
    .where(
      and(
        eq(treasuryTransaction.schoolYearId, schoolYearId),
        eventId ? eq(treasuryTransaction.eventId, eventId) : undefined,
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

const income = sum(
  sql`case when ${treasuryTransaction.amountCents} > 0 then ${treasuryTransaction.amountCents} else 0 end`,
).mapWith(Number);
const expense = sum(
  sql`case when ${treasuryTransaction.amountCents} < 0 then ${treasuryTransaction.amountCents} else 0 end`,
).mapWith(Number);

export async function findYearTotals(db: DbOrTx, schoolYearId: string) {
  const [row] = await db
    .select({ income, expense })
    .from(treasuryTransaction)
    .where(eq(treasuryTransaction.schoolYearId, schoolYearId));
  return { income: row?.income ?? 0, expense: row?.expense ?? 0 };
}

export function findEventTotals(db: DbOrTx, schoolYearId: string) {
  return db
    .select({ eventId: treasuryTransaction.eventId, income, expense })
    .from(treasuryTransaction)
    .where(
      and(
        eq(treasuryTransaction.schoolYearId, schoolYearId),
        isNotNull(treasuryTransaction.eventId),
      ),
    )
    .groupBy(treasuryTransaction.eventId);
}

/** Events of the year (by date range) that have a budget. */
export function findBudgetsBetween(db: DbOrTx, from: string, to: string) {
  return db
    .select({ eventId: eventBudget.eventId, budgetCents: eventBudget.budgetCents })
    .from(eventBudget)
    .innerJoin(event, eq(event.id, eventBudget.eventId))
    .where(sql`(${event.startsAt} at time zone 'Europe/Paris')::date between ${from} and ${to}`);
}

export function findEventsByIds(db: DbOrTx, eventIds: string[]) {
  if (eventIds.length === 0) return Promise.resolve([]);
  return db
    .select({ id: event.id, title: event.title, slug: event.slug, startsAt: event.startsAt })
    .from(event)
    .where(inArray(event.id, eventIds));
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
