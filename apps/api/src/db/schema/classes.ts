import { STUDY_RHYTHMS } from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "./columns";

export const studyRhythm = pgEnum("study_rhythm", STUDY_RHYTHMS);

/** Year of study (1A, 2A… or B1, M2…), ordered by `position`. Managed by administrators. */
export const classLevel = pgTable(
  "class_level",
  {
    id: id(),
    name: text().notNull(),
    position: integer().notNull().default(0),
    /** Work-study only (3rd year on at ESGI): every student of this year is in alternance. */
    alternanceOnly: boolean().notNull().default(false),
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

/** Programmes offered in a year (1A, 2A: tronc commun or MCSI). No row for a year = all. */
export const classLevelTrack = pgTable(
  "class_level_track",
  {
    levelId: uuid()
      .notNull()
      .references(() => classLevel.id, { onDelete: "cascade" }),
    trackId: uuid()
      .notNull()
      .references(() => track.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.levelId, t.trackId] }),
    index("class_level_track_track_id_idx").on(t.trackId),
  ],
);
