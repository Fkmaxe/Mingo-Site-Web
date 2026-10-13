import { sql } from "drizzle-orm";
import { integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, id } from "./columns";

/** Year of study (1A, 2A… or B1, M2…), ordered by `position`. Managed by administrators. */
export const classLevel = pgTable(
  "class_level",
  {
    id: id(),
    name: text().notNull(),
    position: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("class_level_name_unique").on(sql`lower(${t.name})`)],
);

/** Programme (Dev, Cyber, Data…). Managed by administrators. */
export const track = pgTable(
  "track",
  {
    id: id(),
    name: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("track_name_unique").on(sql`lower(${t.name})`)],
);
