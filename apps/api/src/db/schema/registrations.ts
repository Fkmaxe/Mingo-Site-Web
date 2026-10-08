import { type Answers, REGISTRATION_STATUSES, TEAM_STATUSES } from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
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
import { event } from "./events";

export const registrationStatus = pgEnum("registration_status", REGISTRATION_STATUSES);
export const teamStatus = pgEnum("team_status", TEAM_STATUSES);

/** Team of a team event (tournament). Members are the registrations pointing to it. */
export const team = pgTable(
  "team",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    name: text().notNull(),
    joinCode: text().notNull().unique("team_join_code_unique"),
    captainUserId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** A team takes one place of the event: all its members share its status. */
    status: teamStatus().notNull().default("confirmed"),
    waitlistPosition: integer(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "team_waitlist_position_check",
      sql`(${t.status} = 'waitlisted') = (${t.waitlistPosition} is not null)`,
    ),
    index("team_event_status_idx").on(t.eventId, t.status),
    uniqueIndex("team_event_name_unique").on(t.eventId, sql`lower(${t.name})`),
    index("team_captain_user_id_idx").on(t.captainUserId),
  ],
);

export const registration = pgTable(
  "registration",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: registrationStatus().notNull(),
    /** Set while waitlisted (Lot 2). */
    waitlistPosition: integer(),
    /** 32 random bytes, base64url. Never derived from an id. */
    qrToken: text().notNull().unique("registration_qr_token_unique"),
    /** Team event: the team this person registered with (cleared when cancelled). */
    teamId: uuid().references((): AnyPgColumn => team.id, { onDelete: "set null" }),
    /** Answers to the event's custom fields, validated against them by the API. */
    answers: jsonb().$type<Answers>().notNull().default({}),
    cancelledAt: timestamp({ withTimezone: true }),
    /** Set when the day-before reminder was sent (sent once). */
    reminderSentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("registration_event_user_unique").on(t.eventId, t.userId),
    index("registration_user_id_idx").on(t.userId),
    index("registration_team_id_idx").on(t.teamId),
    index("registration_event_status_idx").on(t.eventId, t.status),
    check(
      "registration_cancelled_at_check",
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} is not null)`,
    ),
    check(
      "registration_waitlist_position_check",
      sql`(${t.status} = 'waitlisted') = (${t.waitlistPosition} is not null)`,
    ),
  ],
);
