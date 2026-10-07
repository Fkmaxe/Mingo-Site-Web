import type { CreateTaskData, TaskDto, UpdateTaskData } from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction } from "../../core/tx";
import { getPole } from "../poles";
import {
  findPoleTasks,
  findTask,
  findTasksOfUser,
  insertTask,
  isCurrentPoleMembership,
  type TaskRow,
  updateTask as updateTaskRow,
} from "./tasks.repo";

type AuthzCtx = Pick<AuthedCtx, "user" | "permissions" | "memberships">;

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

function toDto(ctx: AuthzCtx, row: TaskRow): TaskDto {
  const canEdit = canManagePole(ctx, row.task.poleId);
  const a = row.assignee;
  return {
    id: row.task.id,
    title: row.task.title,
    description: row.task.description,
    status: row.task.status,
    dueOn: row.task.dueOn,
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

async function assertAssignee(
  ctx: AuthedCtx,
  membershipId: string | null | undefined,
  poleId: string,
) {
  if (!membershipId) return;
  if (!(await isCurrentPoleMembership(ctx.db, membershipId, poleId))) {
    throw new AppError("VALIDATION_ERROR", 400, "Cette personne n'est pas membre du pôle.", {
      issues: [
        { path: ["assigneeMembershipId"], message: "Cette personne n'est pas membre du pôle." },
      ],
    });
  }
}

export async function listPoleTasks(ctx: AuthedCtx, poleId: string): Promise<TaskDto[]> {
  await getPole(ctx, poleId);
  if (!canViewPole(ctx, poleId)) throw forbidden();
  return (await findPoleTasks(ctx.db, poleId)).map((row) => toDto(ctx, row));
}

export async function listMyTasks(ctx: AuthedCtx): Promise<TaskDto[]> {
  return (await findTasksOfUser(ctx.db, ctx.user.id)).map((row) => toDto(ctx, row));
}

/** A visible task, or 404 (tasks of other poles are not revealed). */
async function visibleTask(ctx: AuthedCtx, taskId: string): Promise<TaskRow> {
  const row = await findTask(ctx.db, taskId);
  const mine = row?.assignee?.userId === ctx.user.id;
  if (!row || !(mine || canViewPole(ctx, row.task.poleId))) throw notFound();
  return row;
}

export async function createTask(ctx: AuthedCtx, poleId: string, input: CreateTaskData) {
  await getPole(ctx, poleId);
  if (!canManagePole(ctx, poleId)) throw forbidden();
  await assertAssignee(ctx, input.assigneeMembershipId, poleId);
  const id = await insertTask(ctx.db, { ...input, poleId, createdBy: ctx.user.id });
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
  await assertAssignee(ctx, input.assigneeMembershipId, row.task.poleId);
  await updateTaskRow(ctx.db, row.task.id, input);
  return toDto(ctx, await visibleTask(ctx, row.task.id));
}

export async function deleteTask(ctx: AuthedCtx, taskId: string, now: Date = new Date()) {
  const row = await visibleTask(ctx, taskId);
  if (!canManagePole(ctx, row.task.poleId)) throw forbidden();
  await inTransaction(ctx.db, async (tx) => {
    await updateTaskRow(tx, row.task.id, { deletedAt: now });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "task.deleted",
      entity: "task",
      entityId: row.task.id,
      payload: { title: row.task.title, poleId: row.task.poleId },
    });
  });
}
