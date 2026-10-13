import { TREASURY_KINDS } from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { event } from "./events";
import { schoolYear } from "./organization";

export const treasuryKind = pgEnum("treasury_kind", TREASURY_KINDS);

/**
 * Money ledger: amounts are signed cents and never change, nor does the kind; a mistake is
 * cancelled by a reversal entry (reversal_of_id). The counterparty, initiator, date, name of an
 * « other » entry, event, comment and receipts can be corrected.
 */
export const treasuryTransaction = pgTable(
  "treasury_transaction",
  {
    id: id(),
    schoolYearId: uuid()
      .notNull()
      .references(() => schoolYear.id, { onDelete: "restrict" }),
    eventId: uuid().references(() => event.id, { onDelete: "restrict" }),
    /** Who the money went to or came from (supplier, sponsor, school…). */
    counterparty: text().notNull(),
    /** BDE member behind the operation; null for older entries. */
    initiatorUserId: uuid().references(() => user.id, { onDelete: "set null" }),
    kind: treasuryKind().notNull(),
    /** Name of an « other » entry. */
    otherLabel: text(),
    amountCents: integer().notNull(),
    occurredOn: date().notNull(),
    comment: text().notNull().default(""),
    /** Link to a receipt, from before receipts were uploaded (read only). */
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
    index("treasury_transaction_initiator_user_id_idx").on(t.initiatorUserId),
    index("treasury_transaction_created_by_idx").on(t.createdBy),
    check("treasury_transaction_amount_check", sql`${t.amountCents} <> 0`),
    check(
      "treasury_transaction_other_label_check",
      sql`(${t.kind} = 'other') = (${t.otherLabel} is not null)`,
    ),
    // A debit takes money out, a credit brings it in; a reversal has the opposite sign.
    check(
      "treasury_transaction_kind_sign_check",
      sql`${t.reversalOfId} is not null or ${t.kind} = 'other'
        or (${t.kind} = 'debit' and ${t.amountCents} < 0)
        or (${t.kind} = 'credit' and ${t.amountCents} > 0)`,
    ),
  ],
);

/** Payment receipt of an entry: a photo or a PDF in the receipts store. */
export const treasuryAttachment = pgTable(
  "treasury_attachment",
  {
    id: id(),
    transactionId: uuid()
      .notNull()
      .references(() => treasuryTransaction.id, { onDelete: "restrict" }),
    /** Name in the receipts store (random, never reused). */
    fileName: text().notNull().unique("treasury_attachment_file_name_unique"),
    /** Name of the file as uploaded, shown to people. */
    originalName: text().notNull(),
    contentType: text().notNull(),
    sizeBytes: integer().notNull(),
    uploadedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("treasury_attachment_transaction_id_idx").on(t.transactionId),
    index("treasury_attachment_uploaded_by_idx").on(t.uploadedBy),
    check("treasury_attachment_size_check", sql`${t.sizeBytes} > 0`),
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
