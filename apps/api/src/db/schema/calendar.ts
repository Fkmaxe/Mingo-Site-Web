import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id } from "./columns";

/**
 * Private iCal subscription link of a member (Apple Calendar, Google Agenda). The token is the
 * only credential of the feed: regenerating it cuts off the old link.
 */
export const calendarFeed = pgTable("calendar_feed", {
  id: id(),
  userId: uuid()
    .notNull()
    .unique("calendar_feed_user_unique")
    .references(() => user.id, { onDelete: "cascade" }),
  token: text().notNull().unique("calendar_feed_token_unique"),
  createdAt: createdAt(),
  lastFetchedAt: timestamp({ withTimezone: true }),
});
