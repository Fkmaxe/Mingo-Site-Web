import { APP_ROLES, BOARD_POSITIONS, MEMBERSHIP_ROLES } from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";

export const membershipRole = pgEnum("membership_role", MEMBERSHIP_ROLES);
export const boardPosition = pgEnum("board_position", BOARD_POSITIONS);
export const appRole = pgEnum("app_role", APP_ROLES);

export const schoolYear = pgTable(
  "school_year",
  {
    id: id(),
    label: text().notNull().unique(),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    isCurrent: boolean().notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("school_year_dates_check", sql`${t.endsOn} > ${t.startsOn}`),
    uniqueIndex("school_year_single_current_idx").on(t.isCurrent).where(sql`${t.isCurrent}`),
  ],
);

export const pole = pgTable("pole", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const membership = pgTable(
  "membership",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null for board members, who act on every pole. */
    poleId: uuid().references(() => pole.id, { onDelete: "restrict" }),
    schoolYearId: uuid()
      .notNull()
      .references(() => schoolYear.id, { onDelete: "restrict" }),
    role: membershipRole().notNull(),
    boardPosition: boardPosition(),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    unique("membership_user_pole_year_unique")
      .on(t.userId, t.poleId, t.schoolYearId)
      .nullsNotDistinct(),
    index("membership_pole_id_idx").on(t.poleId),
    index("membership_school_year_id_idx").on(t.schoolYearId),
    check("membership_board_has_no_pole_check", sql`(${t.role} = 'board') = (${t.poleId} is null)`),
    check(
      "membership_board_position_check",
      sql`${t.boardPosition} is null or ${t.role} = 'board'`,
    ),
  ],
);

export const rolePermission = pgTable(
  "role_permission",
  {
    id: id(),
    role: appRole().notNull(),
    permission: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("role_permission_role_permission_unique").on(t.role, t.permission)],
);
