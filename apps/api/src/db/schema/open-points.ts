import { OPEN_POINTS_SOURCES, OPEN_POINTS_STATUSES } from "@bde/shared";
import { sql } from "drizzle-orm";
import { check, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { attendance } from "./attendance";
import { user } from "./auth";
import { createdAt, id } from "./columns";
import { schoolYear } from "./organization";

export const openPointsStatus = pgEnum("open_points_status", OPEN_POINTS_STATUSES);
export const openPointsSource = pgEnum("open_points_source", OPEN_POINTS_SOURCES);

/**
 * Ledger: one row per movement, never deleted. A balance is a sum, never stored.
 * Only the decision columns (status, decided_*) change after insertion.
 */
export const openPointsLedger = pgTable(
  "open_points_ledger",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schoolYearId: uuid()
      .notNull()
      .references(() => schoolYear.id, { onDelete: "restrict" }),
    delta: integer().notNull(),
    reason: text().notNull(),
    source: openPointsSource().notNull(),
    /** The check-in that produced an automatic movement. */
    attendanceId: uuid()
      .unique("open_points_ledger_attendance_unique")
      .references(() => attendance.id, { onDelete: "set null" }),
    status: openPointsStatus().notNull().default("pending"),
    /** Who validated or rejected it, and when. */
    decidedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp({ withTimezone: true }),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("open_points_ledger_user_idx").on(t.userId, t.schoolYearId),
    index("open_points_ledger_school_year_status_idx").on(t.schoolYearId, t.status),
    index("open_points_ledger_decided_by_idx").on(t.decidedBy),
    index("open_points_ledger_created_by_idx").on(t.createdBy),
    check("open_points_ledger_delta_check", sql`${t.delta} <> 0`),
    check(
      "open_points_ledger_manual_reason_check",
      sql`${t.source} <> 'manual' or length(trim(${t.reason})) > 0`,
    ),
    check(
      "open_points_ledger_decision_check",
      sql`(${t.status} = 'pending') = (${t.decidedAt} is null)`,
    ),
  ],
);
