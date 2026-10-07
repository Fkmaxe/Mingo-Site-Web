import { ATTENDANCE_KINDS } from "@bde/shared";
import { index, pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id } from "./columns";
import { event } from "./events";

export const attendanceKind = pgEnum("attendance_kind", ATTENDANCE_KINDS);

/** One row per person, event and kind. Read by the grade computation (Lot 2). */
export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: attendanceKind().notNull(),
    checkedInAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    checkedInBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("attendance_event_user_kind_unique").on(t.eventId, t.userId, t.kind),
    index("attendance_user_id_idx").on(t.userId),
    index("attendance_checked_in_by_idx").on(t.checkedInBy),
  ],
);
