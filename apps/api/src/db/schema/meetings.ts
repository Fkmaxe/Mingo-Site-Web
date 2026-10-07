import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { pole } from "./organization";

export const meeting = pgTable(
  "meeting",
  {
    id: id(),
    /** Null: general meeting of the whole BDE. */
    poleId: uuid().references(() => pole.id, { onDelete: "restrict" }),
    title: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    location: text().notNull().default(""),
    agenda: text().notNull().default(""),
    minutes: text().notNull().default(""),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("meeting_pole_id_idx").on(t.poleId),
    index("meeting_starts_at_idx").on(t.startsAt),
    index("meeting_created_by_idx").on(t.createdBy),
  ],
);

/** One row per member marked present. Counted in the member grade. */
export const meetingAttendance = pgTable(
  "meeting_attendance",
  {
    id: id(),
    meetingId: uuid()
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    markedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("meeting_attendance_meeting_user_unique").on(t.meetingId, t.userId),
    index("meeting_attendance_user_id_idx").on(t.userId),
    index("meeting_attendance_marked_by_idx").on(t.markedBy),
  ],
);
