import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import { membership, pole, schoolYear, task, user } from "../../db/schema";

const assigneeUser = alias(user, "assignee_user");

const selection = {
  task,
  pole: { id: pole.id, name: pole.name },
  assignee: {
    membershipId: membership.id,
    role: membership.role,
    userId: assigneeUser.id,
    name: assigneeUser.name,
    promo: assigneeUser.promo,
  },
};

function baseQuery(db: DbOrTx) {
  return db
    .select(selection)
    .from(task)
    .innerJoin(pole, eq(pole.id, task.poleId))
    .leftJoin(membership, eq(membership.id, task.assigneeMembershipId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, membership.userId));
}

export type TaskRow = NonNullable<Awaited<ReturnType<typeof findTask>>>;

// Open tasks first, then by due date (no date last), then oldest first.
const order = [
  sql`case ${task.status} when 'doing' then 0 when 'todo' then 1 else 2 end`,
  sql`${task.dueOn} asc nulls last`,
  asc(task.createdAt),
];

export function findPoleTasks(db: DbOrTx, poleId: string) {
  return baseQuery(db)
    .where(and(eq(task.poleId, poleId), isNull(task.deletedAt)))
    .orderBy(...order);
}

export function findTasksOfUser(db: DbOrTx, userId: string) {
  return baseQuery(db)
    .where(and(eq(assigneeUser.id, userId), isNull(task.deletedAt)))
    .orderBy(...order);
}

export async function findTask(db: DbOrTx, taskId: string) {
  const [row] = await baseQuery(db).where(and(eq(task.id, taskId), isNull(task.deletedAt)));
  return row;
}

/** Whether the membership belongs to the pole for the current school year. */
export async function isCurrentPoleMembership(db: DbOrTx, membershipId: string, poleId: string) {
  const [row] = await db
    .select({ id: membership.id })
    .from(membership)
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .where(
      and(
        eq(membership.id, membershipId),
        eq(membership.poleId, poleId),
        eq(schoolYear.isCurrent, true),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
      ),
    );
  return row !== undefined;
}

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
