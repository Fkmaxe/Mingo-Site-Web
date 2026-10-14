import type {
  CreatePersonalTaskData,
  CreateTaskData,
  PoleMemberDto,
  TaskDto,
  TaskScope,
  UpdateTaskData,
} from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction } from "../../core/tx";
import { getPole } from "../poles";
import {
  findBoardMembers,
  findBoardTasks,
  findPoleTasks,
  findTask,
  findTasksOfUser,
  insertTask,
  isCurrentPoleMembership,
  type TaskRow,
  updateTask as updateTaskRow,
} from "./tasks.repo";

type AuthzCtx = Pick<AuthedCtx, "user" | "permissions" | "memberships">;
type Owned = { scope: TaskScope; poleId: string | null; ownerUserId: string | null };

/** Pole lead of that pole or board, with tasks:manage. */
function canManagePole(ctx: AuthzCtx, poleId: string): boolean {
  if (!ctx.permissions.has("tasks:manage")) return false;
  if (ctx.permissions.has("poles:all")) return true;
  return ctx.memberships.some((m) => m.role === "pole_lead" && m.poleId === poleId);
}

/** Members of the pole see its board; so does the board. */
function canViewPole(ctx: AuthzCtx, poleId: string): boolean {
  return ctx.permissions.has("poles:all") || ctx.memberships.some((m) => m.poleId === poleId);
}

/** The bureau board is the bureau's (poles:all: board members and administrators). */
const isBoard = (ctx: AuthzCtx) => ctx.permissions.has("poles:all");

/** Organisers of the task: the pole's, the bureau, or the author of a personal task. */
function canManage(ctx: AuthzCtx, t: Owned): boolean {
  if (t.scope === "personal") return t.ownerUserId === ctx.user.id;
  if (t.scope === "board") return isBoard(ctx);
  return t.poleId !== null && canManagePole(ctx, t.poleId);
}

/** A personal task is seen by its author only, the bureau included. */
function canView(ctx: AuthzCtx, t: Owned): boolean {
  if (t.scope === "personal") return t.ownerUserId === ctx.user.id;
  if (t.scope === "board") return isBoard(ctx);
  return t.poleId !== null && canViewPole(ctx, t.poleId);
}

function toDto(ctx: AuthzCtx, row: TaskRow): TaskDto {
  const canEdit = canManage(ctx, row.task);
  const a = row.assignee;
  return {
    id: row.task.id,
    title: row.task.title,
    description: row.task.description,
    status: row.task.status,
    dueOn: row.task.dueOn,
    scope: row.task.scope,
    pole: row.pole,
    assignee:
      a?.membershipId && a.userId && a.name && a.role
        ? {
            membershipId: a.membershipId,
            role: a.role,
            user: { id: a.userId, name: a.name, promo: a.promo ?? null },
          }
        : null,
    canEdit,
    canMove: canEdit || a?.userId === ctx.user.id,
    createdAt: row.task.createdAt.toISOString(),
  };
}

const forbidden = () => new AppError("FORBIDDEN", 403, "Tu n'as pas les droits pour faire ça.");
const notFound = () => new AppError("NOT_FOUND", 404, "Cette tâche n'existe pas.");

function invalidAssignee(message: string) {
  return new AppError("VALIDATION_ERROR", 400, message, {
    issues: [{ path: ["assigneeMembershipId"], message }],
  });
}

/** A pole task goes to a member of the pole, a bureau task to a seat of the bureau. */
async function assertAssignee(ctx: AuthedCtx, membershipId: string | null | undefined, t: Owned) {
  if (!membershipId) return;
  if (t.scope === "personal") {
    throw invalidAssignee("Une tâche perso n'est assignée à personne.");
  }
  if (!(await isCurrentPoleMembership(ctx.db, membershipId, t.poleId))) {
    throw invalidAssignee(
      t.scope === "board"
        ? "Cette personne n'est pas au bureau."
        : "Cette personne n'est pas membre du pôle.",
    );
  }
}

export async function listPoleTasks(ctx: AuthedCtx, poleId: string): Promise<TaskDto[]> {
  await getPole(ctx, poleId);
  if (!canViewPole(ctx, poleId)) throw forbidden();
  return (await findPoleTasks(ctx.db, poleId)).map((row) => toDto(ctx, row));
}

export async function listBoardTasks(ctx: AuthedCtx): Promise<TaskDto[]> {
  if (!isBoard(ctx)) throw forbidden();
  return (await findBoardTasks(ctx.db)).map((row) => toDto(ctx, row));
}

/** Who a bureau task can be assigned to. */
export async function listBoardMembers(ctx: AuthedCtx): Promise<PoleMemberDto[]> {
  if (!isBoard(ctx)) throw forbidden();
  return findBoardMembers(ctx.db);
}

/** The tasks assigned to me, and my personal tasks. */
export async function listMyTasks(ctx: AuthedCtx): Promise<TaskDto[]> {
  return (await findTasksOfUser(ctx.db, ctx.user.id)).map((row) => toDto(ctx, row));
}

/** A visible task, or 404 (tasks of other poles and other people's personal tasks are hidden). */
async function visibleTask(ctx: AuthedCtx, taskId: string): Promise<TaskRow> {
  const row = await findTask(ctx.db, taskId);
  const mine = row?.assignee?.userId === ctx.user.id;
  if (!row || !(mine || canView(ctx, row.task))) throw notFound();
  return row;
}

export async function createTask(ctx: AuthedCtx, poleId: string, input: CreateTaskData) {
  await getPole(ctx, poleId);
  const owned: Owned = { scope: "pole", poleId, ownerUserId: null };
  if (!canManage(ctx, owned)) throw forbidden();
  await assertAssignee(ctx, input.assigneeMembershipId, owned);
  const id = await insertTask(ctx.db, { ...input, poleId, createdBy: ctx.user.id });
  return toDto(ctx, await visibleTask(ctx, id));
}

export async function createBoardTask(ctx: AuthedCtx, input: CreateTaskData) {
  const owned: Owned = { scope: "board", poleId: null, ownerUserId: null };
  if (!canManage(ctx, owned)) throw forbidden();
  await assertAssignee(ctx, input.assigneeMembershipId, owned);
  const id = await insertTask(ctx.db, { ...input, scope: "board", createdBy: ctx.user.id });
  return toDto(ctx, await visibleTask(ctx, id));
}

/** Personal tasks are for the BDE members of the year, like the task boards. */
export async function createPersonalTask(ctx: AuthedCtx, input: CreatePersonalTaskData) {
  if (ctx.memberships.length === 0) {
    throw new AppError("FORBIDDEN", 403, "Les tâches sont réservées aux membres du BDE.");
  }
  const id = await insertTask(ctx.db, {
    ...input,
    scope: "personal",
    ownerUserId: ctx.user.id,
    createdBy: ctx.user.id,
  });
  return toDto(ctx, await visibleTask(ctx, id));
}

/** Organisers change anything; the assignee may only move the status. */
export async function updateTask(ctx: AuthedCtx, taskId: string, input: UpdateTaskData) {
  const row = await visibleTask(ctx, taskId);
  const dto = toDto(ctx, row);
  const onlyStatus = Object.entries(input).every(
    ([key, value]) => key === "status" || value === undefined,
  );
  if (!dto.canEdit && !(dto.canMove && onlyStatus)) throw forbidden();
  await assertAssignee(ctx, input.assigneeMembershipId, row.task);
  await updateTaskRow(ctx.db, row.task.id, input);
  return toDto(ctx, await visibleTask(ctx, row.task.id));
}

export async function deleteTask(ctx: AuthedCtx, taskId: string, now: Date = new Date()) {
  const row = await visibleTask(ctx, taskId);
  if (!canManage(ctx, row.task)) throw forbidden();
  await inTransaction(ctx.db, async (tx) => {
    await updateTaskRow(tx, row.task.id, { deletedAt: now });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "task.deleted",
      entity: "task",
      entityId: row.task.id,
      payload: { title: row.task.title, scope: row.task.scope, poleId: row.task.poleId },
    });
  });
}
