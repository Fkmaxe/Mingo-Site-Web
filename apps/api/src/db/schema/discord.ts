import { pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id } from "./columns";

/** Discord posts that must go out once (« late-tasks:2026-10-16:<channel> »). */
export const discordPost = pgTable("discord_post", {
  id: id(),
  key: text().notNull().unique("discord_post_key_unique"),
  createdAt: createdAt(),
});
