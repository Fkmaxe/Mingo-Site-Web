import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { event } from "./events";
import { schoolYear } from "./organization";

/**
 * Money ledger: amounts are signed cents and never change; a mistake is cancelled by a
 * reversal entry (reversal_of_id). Only the label, date and receipt link can be edited.
 */
export const treasuryTransaction = pgTable(
  "treasury_transaction",
  {
    id: id(),
    schoolYearId: uuid()
      .notNull()
      .references(() => schoolYear.id, { onDelete: "restrict" }),
    eventId: uuid().references(() => event.id, { onDelete: "restrict" }),
    label: text().notNull(),
    amountCents: integer().notNull(),
    occurredOn: date().notNull(),
    receiptUrl: text(),
    reversalOfId: uuid()
      .unique("treasury_transaction_reversal_of_unique")
      .references((): AnyPgColumn => treasuryTransaction.id, { onDelete: "restrict" }),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("treasury_transaction_year_idx").on(t.schoolYearId, t.occurredOn),
    index("treasury_transaction_event_id_idx").on(t.eventId),
    index("treasury_transaction_created_by_idx").on(t.createdBy),
    check("treasury_transaction_amount_check", sql`${t.amountCents} <> 0`),
  ],
);

/** Planned budget of an event. */
export const eventBudget = pgTable(
  "event_budget",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .unique("event_budget_event_unique")
      .references(() => event.id, { onDelete: "cascade" }),
    budgetCents: integer().notNull(),
    updatedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("event_budget_updated_by_idx").on(t.updatedBy),
    check("event_budget_positive_check", sql`${t.budgetCents} >= 0`),
  ],
);
