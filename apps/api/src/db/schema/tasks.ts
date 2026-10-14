import { TASK_SCOPES, TASK_STATUSES } from "@bde/shared";
import { sql } from "drizzle-orm";
import { check, date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { membership, pole } from "./organization";

export const taskStatus = pgEnum("task_status", TASK_STATUSES);
export const taskScope = pgEnum("task_scope", TASK_SCOPES);

/**
 * A task of a pole board, of the bureau board, or a personal task (no pole, no assignee, seen
 * only by its owner).
 */
export const task = pgTable(
  "task",
  {
    id: id(),
    scope: taskScope().notNull().default("pole"),
    /** Set for a pole task only. */
    poleId: uuid().references(() => pole.id, { onDelete: "restrict" }),
    /** Author of a personal task; null otherwise. */
    ownerUserId: uuid().references(() => user.id, { onDelete: "cascade" }),
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
    index("task_owner_user_id_idx").on(t.ownerUserId),
    index("task_assignee_membership_id_idx").on(t.assigneeMembershipId),
    index("task_created_by_idx").on(t.createdBy),
    check("task_pole_scope_check", sql`(${t.scope} = 'pole') = (${t.poleId} is not null)`),
    check(
      "task_personal_scope_check",
      sql`(${t.scope} = 'personal') = (${t.ownerUserId} is not null)`,
    ),
    check(
      "task_personal_unassigned_check",
      sql`${t.scope} <> 'personal' or ${t.assigneeMembershipId} is null`,
    ),
  ],
);
