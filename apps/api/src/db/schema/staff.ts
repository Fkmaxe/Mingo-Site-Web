import { STAFF_ASSIGNMENT_STATUSES } from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { event } from "./events";
import { membership } from "./organization";

export const staffAssignmentStatus = pgEnum("staff_assignment_status", STAFF_ASSIGNMENT_STATUSES);

export const staffSlot = pgTable(
  "staff_slot",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    label: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    capacity: integer().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("staff_slot_event_id_idx").on(t.eventId),
    check("staff_slot_dates_check", sql`${t.endsAt} > ${t.startsAt}`),
    check("staff_slot_capacity_check", sql`${t.capacity} > 0`),
  ],
);

export const staffAssignment = pgTable(
  "staff_assignment",
  {
    id: id(),
    staffSlotId: uuid()
      .notNull()
      .references(() => staffSlot.id, { onDelete: "cascade" }),
    membershipId: uuid()
      .notNull()
      .references(() => membership.id, { onDelete: "cascade" }),
    status: staffAssignmentStatus().notNull().default("proposed"),
    decidedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    /** Set when the day-before reminder was sent (sent once). */
    reminderSentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("staff_assignment_slot_membership_unique").on(t.staffSlotId, t.membershipId),
    index("staff_assignment_membership_id_idx").on(t.membershipId),
    index("staff_assignment_decided_by_idx").on(t.decidedBy),
  ],
);
