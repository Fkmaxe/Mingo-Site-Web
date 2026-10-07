import { REGISTRATION_STATUSES } from "@bde/shared";
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

export const registrationStatus = pgEnum("registration_status", REGISTRATION_STATUSES);

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
    cancelledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("registration_event_user_unique").on(t.eventId, t.userId),
    index("registration_user_id_idx").on(t.userId),
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
