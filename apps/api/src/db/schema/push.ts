import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id } from "./columns";

/** One row per device (browser) that accepted notifications. */
export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Push service URL, unique per browser install. */
    endpoint: text().notNull().unique("push_subscription_endpoint_unique"),
    p256dh: text().notNull(),
    auth: text().notNull(),
    /** Also notify this device when an event is published. */
    newEvents: boolean().notNull().default(true),
    createdAt: createdAt(),
    lastSentAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("push_subscription_user_id_idx").on(t.userId)],
);
