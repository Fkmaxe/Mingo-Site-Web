import { TASK_PRIORITIES, TASK_SCOPES, TASK_STATUSES } from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
import { membership, pole } from "./organization";

export const taskStatus = pgEnum("task_status", TASK_STATUSES);
export const taskScope = pgEnum("task_scope", TASK_SCOPES);
export const taskPriority = pgEnum("task_priority", TASK_PRIORITIES);

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
    priority: taskPriority().notNull().default("normal"),
    dueOn: date(),
    /** The deadline whose day-before reminder was sent: a new deadline gets its own. */
    reminderSentFor: date(),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("task_pole_id_idx").on(t.poleId, t.status),
    index("task_owner_user_id_idx").on(t.ownerUserId),
    index("task_created_by_idx").on(t.createdBy),
    check("task_pole_scope_check", sql`(${t.scope} = 'pole') = (${t.poleId} is not null)`),
    check(
      "task_personal_scope_check",
      sql`(${t.scope} = 'personal') = (${t.ownerUserId} is not null)`,
    ),
  ],
);

/** People on a task: memberships of its pole (or seats of the bureau). Never on a personal task. */
export const taskAssignee = pgTable(
  "task_assignee",
  {
    id: id(),
    taskId: uuid()
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    membershipId: uuid()
      .notNull()
      .references(() => membership.id, { onDelete: "cascade" }),
    assignedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("task_assignee_task_membership_unique").on(t.taskId, t.membershipId),
    index("task_assignee_membership_idx").on(t.membershipId),
    index("task_assignee_assigned_by_idx").on(t.assignedBy),
  ],
);

/** Steps of a task, ticked by its organisers and assignees. */
export const taskChecklistItem = pgTable(
  "task_checklist_item",
  {
    id: id(),
    taskId: uuid()
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    label: text().notNull(),
    done: boolean().notNull().default(false),
    position: integer().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("task_checklist_item_task_id_idx").on(t.taskId, t.position)],
);

export const taskComment = pgTable(
  "task_comment",
  {
    id: id(),
    taskId: uuid()
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    authorUserId: uuid().references(() => user.id, { onDelete: "set null" }),
    body: text().notNull(),
    createdAt: createdAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("task_comment_task_id_idx").on(t.taskId, t.createdAt),
    index("task_comment_author_user_id_idx").on(t.authorUserId),
  ],
);

/** A file joined to a task, in the task files store. */
export const taskAttachment = pgTable(
  "task_attachment",
  {
    id: id(),
    taskId: uuid()
      .notNull()
      .references(() => task.id, { onDelete: "restrict" }),
    /** Name in the task files store (random, never reused). */
    fileName: text().notNull().unique("task_attachment_file_name_unique"),
    /** Name of the file as uploaded, shown to people. */
    originalName: text().notNull(),
    contentType: text().notNull(),
    sizeBytes: integer().notNull(),
    uploadedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("task_attachment_task_id_idx").on(t.taskId),
    index("task_attachment_uploaded_by_idx").on(t.uploadedBy),
    check("task_attachment_size_check", sql`${t.sizeBytes} > 0`),
  ],
);
