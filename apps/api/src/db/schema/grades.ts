import { GRADE_STATUSES } from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { membership, schoolYear } from "./organization";

export const gradeStatus = pgEnum("grade_status", GRADE_STATUSES);

/** Points with 2 decimals, read as numbers. */
const points = () => numeric({ precision: 7, scale: 2, mode: "number" });

export const gradePeriod = pgTable(
  "grade_period",
  {
    id: id(),
    schoolYearId: uuid()
      .notNull()
      .references(() => schoolYear.id, { onDelete: "restrict" }),
    label: text().notNull(),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    scaleMax: integer().notNull().default(20),
    pointsPerPresence: points().notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("grade_period_school_year_id_idx").on(t.schoolYearId),
    check("grade_period_dates_check", sql`${t.endsOn} >= ${t.startsOn}`),
    check("grade_period_scale_check", sql`${t.scaleMax} > 0`),
    check("grade_period_points_check", sql`${t.pointsPerPresence} >= 0`),
  ],
);

export const memberGrade = pgTable(
  "member_grade",
  {
    id: id(),
    membershipId: uuid()
      .notNull()
      .references(() => membership.id, { onDelete: "cascade" }),
    gradePeriodId: uuid()
      .notNull()
      .references(() => gradePeriod.id, { onDelete: "cascade" }),
    involvementPoints: points().notNull().default(0),
    /** Snapshot taken at validation; null while the presence points are computed live. */
    presencePoints: points(),
    finalScore: points(),
    comment: text().notNull().default(""),
    status: gradeStatus().notNull().default("draft"),
    proposedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    validatedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("member_grade_membership_period_unique").on(t.membershipId, t.gradePeriodId),
    index("member_grade_grade_period_id_idx").on(t.gradePeriodId),
    index("member_grade_proposed_by_idx").on(t.proposedBy),
    index("member_grade_validated_by_idx").on(t.validatedBy),
    check("member_grade_involvement_check", sql`${t.involvementPoints} >= 0`),
    check(
      "member_grade_snapshot_check",
      sql`${t.status} in ('draft', 'submitted') or (${t.presencePoints} is not null and ${t.finalScore} is not null)`,
    ),
  ],
);
