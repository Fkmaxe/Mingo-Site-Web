import type { TaskStatus } from "@bde/shared";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import {
  auditLog,
  membership,
  pole,
  schoolYear,
  task,
  taskAssignee,
  taskAttachment,
  taskChecklistItem,
  taskComment,
  user,
} from "../../db/schema";

const selection = { task, pole: { id: pole.id, name: pole.name } };

function baseQuery(db: DbOrTx) {
  return db.select(selection).from(task).leftJoin(pole, eq(pole.id, task.poleId));
}

export type TaskRow = NonNullable<Awaited<ReturnType<typeof findTask>>>;

// Open tasks first, then high priority, then by due date (no date last), then oldest first.
const order = [
  sql`case ${task.status} when 'doing' then 0 when 'todo' then 1 else 2 end`,
  sql`case ${task.priority} when 'high' then 0 when 'normal' then 1 else 2 end`,
  sql`${task.dueOn} asc nulls last`,
  asc(task.createdAt),
];

const live = isNull(task.deletedAt);

/** Tasks the user is assigned to (any of their memberships). */
const assignedTo = (userId: string) =>
  inArray(
    task.id,
    sql`(select ${taskAssignee.taskId} from ${taskAssignee}
         join ${membership} on ${membership.id} = ${taskAssignee.membershipId}
         where ${membership.userId} = ${userId})`,
  );

export function findPoleTasks(db: DbOrTx, poleId: string) {
  return baseQuery(db)
    .where(and(eq(task.poleId, poleId), live))
    .orderBy(...order);
}

export function findBoardTasks(db: DbOrTx) {
  return baseQuery(db)
    .where(and(eq(task.scope, "board"), live))
    .orderBy(...order);
}

/** Tasks assigned to the user, and their personal tasks. */
export function findTasksOfUser(db: DbOrTx, userId: string) {
  return baseQuery(db)
    .where(and(or(assignedTo(userId), eq(task.ownerUserId, userId)), live))
    .orderBy(...order);
}

function contains(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Gestion → Tâches: the bureau board (if `withBoard`) and the given poles, filtered. */
export function findManagedTasks(
  db: DbOrTx,
  params: {
    withBoard: boolean;
    poleIds: "all" | string[];
    status?: TaskStatus | undefined;
    assigneeUserId?: string | undefined;
    lateOn?: string | undefined;
    q?: string | undefined;
  },
) {
  const poles =
    params.poleIds === "all"
      ? eq(task.scope, "pole")
      : params.poleIds.length > 0
        ? inArray(task.poleId, params.poleIds)
        : undefined;
  const boards = [params.withBoard ? eq(task.scope, "board") : undefined, poles].filter(
    (c): c is SQL => c !== undefined,
  );
  if (boards.length === 0) return Promise.resolve([]);
  return baseQuery(db)
    .where(
      and(
        live,
        or(...boards),
        params.status ? eq(task.status, params.status) : undefined,
        params.assigneeUserId ? assignedTo(params.assigneeUserId) : undefined,
        params.lateOn ? and(ne(task.status, "done"), lt(task.dueOn, params.lateOn)) : undefined,
        params.q
          ? or(ilike(task.title, contains(params.q)), ilike(task.description, contains(params.q)))
          : undefined,
      ),
    )
    .orderBy(...order)
    .limit(300);
}

export async function findTask(db: DbOrTx, taskId: string) {
  const [row] = await baseQuery(db).where(and(eq(task.id, taskId), live));
  return row;
}

/** Locks the task row: serialises the writes that count its files. */
export async function lockTask(db: DbOrTx, taskId: string) {
  await db.select({ id: task.id }).from(task).where(eq(task.id, taskId)).for("update");
}

// --- Assignees ---

const assigneeSelection = {
  taskId: taskAssignee.taskId,
  membershipId: membership.id,
  role: membership.role,
  user: { id: user.id, name: user.name, promo: user.promo },
};

/** Assignees of the tasks, by task id. */
export async function findAssignees(db: DbOrTx, taskIds: string[]) {
  const byTask = new Map<string, Omit<(typeof rows)[number], "taskId">[]>();
  if (taskIds.length === 0) return byTask;
  const rows = await db
    .select(assigneeSelection)
    .from(taskAssignee)
    .innerJoin(membership, eq(membership.id, taskAssignee.membershipId))
    .innerJoin(user, eq(user.id, membership.userId))
    .where(inArray(taskAssignee.taskId, taskIds))
    .orderBy(asc(user.name));
  for (const { taskId, ...assignee } of rows) {
    byTask.set(taskId, [...(byTask.get(taskId) ?? []), assignee]);
  }
  return byTask;
}

/** Replaces the assignees of the task; returns the memberships added and removed. */
export async function setAssignees(
  db: DbOrTx,
  taskId: string,
  membershipIds: string[],
  assignedBy: string,
) {
  const removed = await db
    .delete(taskAssignee)
    .where(
      and(
        eq(taskAssignee.taskId, taskId),
        membershipIds.length > 0 ? notInArray(taskAssignee.membershipId, membershipIds) : undefined,
      ),
    )
    .returning({ membershipId: taskAssignee.membershipId });
  const added =
    membershipIds.length === 0
      ? []
      : await db
          .insert(taskAssignee)
          .values(membershipIds.map((membershipId) => ({ taskId, membershipId, assignedBy })))
          .onConflictDoNothing()
          .returning({ membershipId: taskAssignee.membershipId });
  return {
    added: added.map((a) => a.membershipId),
    removed: removed.map((r) => r.membershipId),
  };
}

const currentMembership = and(
  eq(schoolYear.isCurrent, true),
  eq(membership.isActive, true),
  isNull(membership.deletedAt),
);

/**
 * Of the memberships, those belonging to the pole for the current school year; with a null
 * pole, the seats of the bureau.
 */
export async function findCurrentPoleMemberships(
  db: DbOrTx,
  membershipIds: string[],
  poleId: string | null,
) {
  if (membershipIds.length === 0) return [];
  return db
    .select({ id: membership.id, name: user.name })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .where(
      and(
        inArray(membership.id, membershipIds),
        poleId ? eq(membership.poleId, poleId) : eq(membership.role, "board"),
        currentMembership,
      ),
    );
}

/** The bureau of the current school year: who a bureau task can be assigned to. */
export function findBoardMembers(db: DbOrTx) {
  return db
    .select({
      membershipId: membership.id,
      role: membership.role,
      user: { id: user.id, name: user.name, promo: user.promo },
    })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .where(and(eq(membership.role, "board"), currentMembership))
    .orderBy(asc(user.name));
}

// --- Counts shown on the cards ---

export async function findCounts(db: DbOrTx, taskIds: string[]) {
  const counts = new Map<
    string,
    { done: number; total: number; attachments: number; comments: number }
  >();
  if (taskIds.length === 0) return counts;
  const [checklist, attachments, comments] = await Promise.all([
    db
      .select({
        taskId: taskChecklistItem.taskId,
        total: count(),
        done: sql<number>`count(*) filter (where ${taskChecklistItem.done})`.mapWith(Number),
      })
      .from(taskChecklistItem)
      .where(inArray(taskChecklistItem.taskId, taskIds))
      .groupBy(taskChecklistItem.taskId),
    db
      .select({ taskId: taskAttachment.taskId, n: count() })
      .from(taskAttachment)
      .where(inArray(taskAttachment.taskId, taskIds))
      .groupBy(taskAttachment.taskId),
    db
      .select({ taskId: taskComment.taskId, n: count() })
      .from(taskComment)
      .where(and(inArray(taskComment.taskId, taskIds), isNull(taskComment.deletedAt)))
      .groupBy(taskComment.taskId),
  ]);
  const entry = (id: string) => {
    const e = counts.get(id) ?? { done: 0, total: 0, attachments: 0, comments: 0 };
    counts.set(id, e);
    return e;
  };
  for (const c of checklist) Object.assign(entry(c.taskId), { done: c.done, total: c.total });
  for (const a of attachments) entry(a.taskId).attachments = a.n;
  for (const c of comments) entry(c.taskId).comments = c.n;
  return counts;
}

// --- Checklist ---

export function findChecklist(db: DbOrTx, taskId: string) {
  return db
    .select({
      id: taskChecklistItem.id,
      label: taskChecklistItem.label,
      done: taskChecklistItem.done,
    })
    .from(taskChecklistItem)
    .where(eq(taskChecklistItem.taskId, taskId))
    .orderBy(asc(taskChecklistItem.position), asc(taskChecklistItem.createdAt));
}

export async function findChecklistItem(db: DbOrTx, itemId: string) {
  const [row] = await db.select().from(taskChecklistItem).where(eq(taskChecklistItem.id, itemId));
  return row;
}

/** Appends a step at the end of the list. */
export async function insertChecklistItem(db: DbOrTx, taskId: string, label: string) {
  const [stats] = await db
    .select({ n: count(), last: sql<number>`coalesce(max(${taskChecklistItem.position}), -1)` })
    .from(taskChecklistItem)
    .where(eq(taskChecklistItem.taskId, taskId));
  const [row] = await db
    .insert(taskChecklistItem)
    .values({ taskId, label, position: Number(stats?.last ?? -1) + 1 })
    .returning({ id: taskChecklistItem.id });
  if (!row) throw new Error("insertChecklistItem: aucune ligne");
  return { id: row.id, countBefore: stats?.n ?? 0 };
}

export async function updateChecklistItem(
  db: DbOrTx,
  itemId: string,
  values: Patch<typeof taskChecklistItem.$inferInsert>,
) {
  const changes = compact(values);
  if (!changes) return;
  await db.update(taskChecklistItem).set(changes).where(eq(taskChecklistItem.id, itemId));
}

export async function deleteChecklistItem(db: DbOrTx, itemId: string) {
  await db.delete(taskChecklistItem).where(eq(taskChecklistItem.id, itemId));
}

// --- Comments ---

export function findComments(db: DbOrTx, taskId: string) {
  return db
    .select({
      id: taskComment.id,
      body: taskComment.body,
      createdAt: taskComment.createdAt,
      authorUserId: taskComment.authorUserId,
      authorName: user.name,
    })
    .from(taskComment)
    .leftJoin(user, eq(user.id, taskComment.authorUserId))
    .where(and(eq(taskComment.taskId, taskId), isNull(taskComment.deletedAt)))
    .orderBy(asc(taskComment.createdAt));
}

export async function findComment(db: DbOrTx, commentId: string) {
  const [row] = await db
    .select()
    .from(taskComment)
    .where(and(eq(taskComment.id, commentId), isNull(taskComment.deletedAt)));
  return row;
}

export async function insertComment(db: DbOrTx, values: typeof taskComment.$inferInsert) {
  const [row] = await db.insert(taskComment).values(values).returning({ id: taskComment.id });
  if (!row) throw new Error("insertComment: aucune ligne");
  return row.id;
}

export async function softDeleteComment(db: DbOrTx, commentId: string, now: Date) {
  await db.update(taskComment).set({ deletedAt: now }).where(eq(taskComment.id, commentId));
}

// --- Attachments ---

export function findAttachments(db: DbOrTx, taskId: string) {
  return db
    .select({ attachment: taskAttachment, uploaderName: user.name })
    .from(taskAttachment)
    .leftJoin(user, eq(user.id, taskAttachment.uploadedBy))
    .where(eq(taskAttachment.taskId, taskId))
    .orderBy(asc(taskAttachment.createdAt));
}

export async function countAttachments(db: DbOrTx, taskId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(taskAttachment)
    .where(eq(taskAttachment.taskId, taskId));
  return row?.n ?? 0;
}

export async function findAttachment(db: DbOrTx, attachmentId: string) {
  const [row] = await db.select().from(taskAttachment).where(eq(taskAttachment.id, attachmentId));
  return row;
}

export async function findAttachmentByFileName(db: DbOrTx, fileName: string) {
  const [row] = await db.select().from(taskAttachment).where(eq(taskAttachment.fileName, fileName));
  return row;
}

export async function insertAttachment(db: DbOrTx, values: typeof taskAttachment.$inferInsert) {
  const [row] = await db.insert(taskAttachment).values(values).returning({ id: taskAttachment.id });
  if (!row) throw new Error("insertAttachment: aucune ligne");
  return row.id;
}

export async function deleteAttachment(db: DbOrTx, attachmentId: string) {
  await db.delete(taskAttachment).where(eq(taskAttachment.id, attachmentId));
}

// --- History ---

/** The task's entries of the audit log, newest first. */
export function findHistory(db: DbOrTx, taskId: string) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      payload: auditLog.payload,
      createdAt: auditLog.createdAt,
      actorId: user.id,
      actorName: user.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorUserId))
    .where(and(eq(auditLog.entity, "task"), eq(auditLog.entityId, taskId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(100);
}

// --- Writes on the task ---

export async function insertTask(db: DbOrTx, values: typeof task.$inferInsert) {
  const [row] = await db.insert(task).values(values).returning({ id: task.id });
  if (!row) throw new Error("insertTask: aucune ligne");
  return row.id;
}

export async function updateTask(
  db: DbOrTx,
  taskId: string,
  values: Patch<typeof task.$inferInsert>,
) {
  const changes = compact(values);
  if (!changes) return;
  await db.update(task).set(changes).where(eq(task.id, taskId));
}
