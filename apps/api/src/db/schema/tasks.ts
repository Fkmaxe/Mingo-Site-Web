import { TASK_STATUSES } from "@bde/shared";
import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { membership, pole } from "./organization";

export const taskStatus = pgEnum("task_status", TASK_STATUSES);

export const task = pgTable(
  "task",
  {
    id: id(),
    poleId: uuid()
      .notNull()
      .references(() => pole.id, { onDelete: "restrict" }),
    title: text().notNull(),
    description: text().notNull().default(""),
    status: taskStatus().notNull().default("todo"),
    assigneeMembershipId: uuid().references(() => membership.id, { onDelete: "set null" }),
    dueOn: date(),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("task_pole_id_idx").on(t.poleId, t.status),
    index("task_assignee_membership_id_idx").on(t.assigneeMembershipId),
    index("task_created_by_idx").on(t.createdBy),
  ],
);
