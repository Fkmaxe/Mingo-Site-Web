import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
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
    .leftJoin(pole, eq(pole.id, task.poleId))
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

export function findBoardTasks(db: DbOrTx) {
  return baseQuery(db)
    .where(and(eq(task.scope, "board"), isNull(task.deletedAt)))
    .orderBy(...order);
}

/** Tasks assigned to the user, and their personal tasks. */
export function findTasksOfUser(db: DbOrTx, userId: string) {
  return baseQuery(db)
    .where(
      and(or(eq(assigneeUser.id, userId), eq(task.ownerUserId, userId)), isNull(task.deletedAt)),
    )
    .orderBy(...order);
}

export async function findTask(db: DbOrTx, taskId: string) {
  const [row] = await baseQuery(db).where(and(eq(task.id, taskId), isNull(task.deletedAt)));
  return row;
}

const currentMembership = and(
  eq(schoolYear.isCurrent, true),
  eq(membership.isActive, true),
  isNull(membership.deletedAt),
);

/**
 * Whether the membership belongs to the pole for the current school year; with a null pole,
 * whether it is a seat of the bureau.
 */
export async function isCurrentPoleMembership(
  db: DbOrTx,
  membershipId: string,
  poleId: string | null,
) {
  const [row] = await db
    .select({ id: membership.id })
    .from(membership)
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .where(
      and(
        eq(membership.id, membershipId),
        poleId ? eq(membership.poleId, poleId) : eq(membership.role, "board"),
        currentMembership,
      ),
    );
  return row !== undefined;
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
