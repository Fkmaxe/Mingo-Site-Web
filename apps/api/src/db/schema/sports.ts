import { sql } from "drizzle-orm";
import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, id } from "./columns";

/** Sports of the internal league (tennis de table, badminton…), listed like the categories. */
export const sport = pgTable(
  "sport",
  {
    id: id(),
    name: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sport_name_unique").on(sql`lower(${t.name})`)],
);
