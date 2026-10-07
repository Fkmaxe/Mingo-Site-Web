import { type CustomFieldDef, EVENT_STATUSES, EVENT_VISIBILITIES } from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { pole } from "./organization";

export const eventVisibility = pgEnum("event_visibility", EVENT_VISIBILITIES);
export const eventStatus = pgEnum("event_status", EVENT_STATUSES);

export const event = pgTable(
  "event",
  {
    id: id(),
    poleId: uuid()
      .notNull()
      .references(() => pole.id, { onDelete: "restrict" }),
    title: text().notNull(),
    slug: text().notNull().unique(),
    description: text().notNull().default(""),
    posterUrl: text(),
    location: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    visibility: eventVisibility().notNull(),
    /** Null: unlimited. */
    capacity: integer(),
    /** Null: registrations open until the event ends. */
    registrationDeadline: timestamp({ withTimezone: true }),
    openPointsValue: integer().notNull().default(0),
    status: eventStatus().notNull().default("draft"),
    customFieldsSchema: jsonb().$type<CustomFieldDef[]>().notNull().default([]),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("event_pole_id_idx").on(t.poleId),
    index("event_created_by_idx").on(t.createdBy),
    index("event_starts_at_idx").on(t.startsAt, t.id),
    check("event_dates_check", sql`${t.endsAt} > ${t.startsAt}`),
    check(
      "event_deadline_check",
      sql`${t.registrationDeadline} is null or ${t.registrationDeadline} <= ${t.endsAt}`,
    ),
    check("event_capacity_check", sql`${t.capacity} is null or ${t.capacity} > 0`),
    check("event_open_points_check", sql`${t.openPointsValue} >= 0`),
  ],
);
