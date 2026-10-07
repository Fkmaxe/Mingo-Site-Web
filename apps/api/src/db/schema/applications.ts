import { APPLICATION_STATUSES } from "@bde/shared";
import { index, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { pole, schoolYear } from "./organization";

export const applicationStatus = pgEnum("application_status", APPLICATION_STATUSES);

export const application = pgTable(
  "application",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schoolYearId: uuid()
      .notNull()
      .references(() => schoolYear.id, { onDelete: "restrict" }),
    wishedPoleId: uuid()
      .notNull()
      .references(() => pole.id, { onDelete: "restrict" }),
    motivation: text().notNull(),
    status: applicationStatus().notNull().default("new"),
    decidedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("application_user_year_unique").on(t.userId, t.schoolYearId),
    index("application_school_year_status_idx").on(t.schoolYearId, t.status),
    index("application_wished_pole_id_idx").on(t.wishedPoleId),
    index("application_decided_by_idx").on(t.decidedBy),
  ],
);
