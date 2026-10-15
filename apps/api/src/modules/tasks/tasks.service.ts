import {
  type CreatePersonalTaskData,
  type CreateTaskData,
  type ListTasksQuery,
  type PoleMemberDto,
  TASK_CHECKLIST_MAX,
  TASK_FILE_MAX_BYTES,
  TASK_FILES_PER_TASK,
  type TaskDetailDto,
  type TaskDto,
  type TaskFileType,
  type TaskScope,
  type UpdateChecklistItemData,
  type UpdateTaskData,
} from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { parisDate } from "../../core/time";
import { inTransaction } from "../../core/tx";
import type { DbOrTx } from "../../db/client";
import { sniffTaskFileType, type TaskFileStore } from "../../lib/storage";
import { getPole } from "../poles";
import {
  countAttachments,
  deleteAttachment,
  deleteChecklistItem as deleteChecklistItemRow,
  findAssignees,
  findAttachment,
  findAttachmentByFileName,
  findAttachments,
  findBoardMembers,
  findBoardTasks,
  findChecklist,
  findChecklistItem,
  findComment,
  findComments,
  findCounts,
  findCurrentPoleMemberships,
  findHistory,
  findManagedTasks,
  findPoleTasks,
  findTask,
  findTasksOfUser,
  insertAttachment,
  insertChecklistItem,
  insertComment,
  insertTask,
  lockTask,
  setAssignees,
  softDeleteComment,
  type TaskRow,
  updateChecklistItem as updateChecklistItemRow,
  updateTask as updateTaskRow,
} from "./tasks.repo";

type AuthzCtx = Pick<AuthedCtx, "user" | "roles" | "permissions" | "memberships">;
type Owned = { scope: TaskScope; poleId: string | null; ownerUserId: string | null };
type Assignee = PoleMemberDto;

/** Pole lead of that pole or board, with tasks:manage. */
function canManagePole(ctx: AuthzCtx, poleId: string): boolean {
  if (!ctx.permissions.has("tasks:manage")) return false;
  if (ctx.permissions.has("poles:all")) return true;
  return ctx.memberships.some((m) => m.role === "pole_lead" && m.poleId === poleId);
}

/** Members of the pole see its board; so do the board and every pole lead (read only). */
function canViewPole(ctx: AuthzCtx, poleId: string): boolean {
  return (
    ctx.permissions.has("poles:all") ||
    ctx.roles.includes("pole_lead") ||
    ctx.memberships.some((m) => m.poleId === poleId)
  );
}

/** The bureau board is the bureau's (poles:all: board members and administrators). */
const isBoard = (ctx: AuthzCtx) => ctx.permissions.has("poles:all");

/** Organisers of the task: the pole's, the bureau, or the author of a personal task. */
function canManage(ctx: AuthzCtx, t: Owned): boolean {
  if (t.scope === "personal") return t.ownerUserId === ctx.user.id;
  if (t.scope === "board") return isBoard(ctx);
  return t.poleId !== null && canManagePole(ctx, t.poleId);
}

/** A personal task is seen by its author only, the bureau included; assignees see theirs. */
function canView(ctx: AuthzCtx, t: Owned, assigned: boolean): boolean {
  if (t.scope === "personal") return t.ownerUserId === ctx.user.id;
  if (assigned) return true;
  if (t.scope === "board") return isBoard(ctx);
  return t.poleId !== null && canViewPole(ctx, t.poleId);
}

type Rights = { canEdit: boolean; canContribute: boolean };

function rightsOf(ctx: AuthzCtx, t: Owned, assignees: Assignee[]): Rights {
  const canEdit = canManage(ctx, t);
  return { canEdit, canContribute: canEdit || assignees.some((a) => a.user.id === ctx.user.id) };
}

const forbidden = () => new AppError("FORBIDDEN", 403, "Tu n'as pas les droits pour faire ça.");
const notFound = () => new AppError("NOT_FOUND", 404, "Cette tâche n'existe pas.");

/** Cards of a list: assignees and counts loaded in a few queries for all of them. */
async function toDtos(ctx: AuthedCtx, rows: TaskRow[]): Promise<TaskDto[]> {
  const ids = rows.map((r) => r.task.id);
  const [assignees, counts] = await Promise.all([
    findAssignees(ctx.db, ids),
    findCounts(ctx.db, ids),
  ]);
  return rows.map((row) => {
    const people = assignees.get(row.task.id) ?? [];
    const c = counts.get(row.task.id) ?? { done: 0, total: 0, attachments: 0, comments: 0 };
    return {
      id: row.task.id,
      title: row.task.title,
      description: row.task.description,
      status: row.task.status,
      priority: row.task.priority,
      dueOn: row.task.dueOn,
      scope: row.task.scope,
      pole: row.pole,
      assignees: people,
      checklist: { done: c.done, total: c.total },
      attachmentCount: c.attachments,
      commentCount: c.comments,
      ...rightsOf(ctx, row.task, people),
      createdAt: row.task.createdAt.toISOString(),
    };
  });
}

/** A visible task with its assignees and the user's rights, or 404. */
async function visibleTask(ctx: AuthedCtx, taskId: string) {
  const row = await findTask(ctx.db, taskId);
  if (!row) throw notFound();
  const assignees = (await findAssignees(ctx.db, [row.task.id])).get(row.task.id) ?? [];
  const assigned = assignees.some((a) => a.user.id === ctx.user.id);
  if (!canView(ctx, row.task, assigned)) throw notFound();
  return { row, assignees, rights: rightsOf(ctx, row.task, assignees) };
}

async function editableTask(ctx: AuthedCtx, taskId: string) {
  const found = await visibleTask(ctx, taskId);
  if (!found.rights.canEdit) throw forbidden();
  return found;
}

async function contributableTask(ctx: AuthedCtx, taskId: string) {
  const found = await visibleTask(ctx, taskId);
  if (!found.rights.canContribute) throw forbidden();
  return found;
}

function invalidAssignees(message: string) {
  return new AppError("VALIDATION_ERROR", 400, message, {
    issues: [{ path: ["assigneeMembershipIds"], message }],
  });
}

type Person = { name: string };

/**
 * A pole task goes to members of the pole, a bureau task to seats of the bureau. Returns the
 * people of the valid memberships, for the history.
 */
async function checkAssignees(db: DbOrTx, membershipIds: string[], t: Owned) {
  const ids = [...new Set(membershipIds)];
  if (ids.length === 0) return { ids, people: new Map<string, Person>() };
  if (t.scope === "personal") throw invalidAssignees("Une tâche perso n'est assignée à personne.");
  const valid = await findCurrentPoleMemberships(db, ids, t.poleId);
  if (valid.length !== ids.length) {
    throw invalidAssignees(
      t.scope === "board"
        ? "Une de ces personnes n'est pas au bureau."
        : "Une de ces personnes n'est pas membre du pôle.",
    );
  }
  return { ids, people: new Map(valid.map(({ id, ...person }) => [id, person])) };
}

const audit = (
  db: DbOrTx,
  ctx: AuthedCtx,
  taskId: string,
  action: string,
  payload?: Record<string, unknown>,
) =>
  writeAudit(db, {
    actorUserId: ctx.user.id,
    action,
    entity: "task",
    entityId: taskId,
    ...(payload ? { payload } : {}),
  });

// --- Lists ---

export async function listPoleTasks(ctx: AuthedCtx, poleId: string): Promise<TaskDto[]> {
  await getPole(ctx, poleId);
  if (!canViewPole(ctx, poleId)) throw forbidden();
  return toDtos(ctx, await findPoleTasks(ctx.db, poleId));
}

export async function listBoardTasks(ctx: AuthedCtx): Promise<TaskDto[]> {
  if (!isBoard(ctx)) throw forbidden();
  return toDtos(ctx, await findBoardTasks(ctx.db));
}

/** Who a bureau task can be assigned to. */
export async function listBoardMembers(ctx: AuthedCtx): Promise<PoleMemberDto[]> {
  if (!isBoard(ctx)) throw forbidden();
  return findBoardMembers(ctx.db);
}

/** The tasks assigned to me, and my personal tasks. */
export async function listMyTasks(ctx: AuthedCtx): Promise<TaskDto[]> {
  return toDtos(ctx, await findTasksOfUser(ctx.db, ctx.user.id));
}

/**
 * Gestion → Tâches: the bureau sees its board and every pole; a pole lead sees every pole (and
 * edits only theirs: `canEdit`).
 */
export async function listManagedTasks(
  ctx: AuthedCtx,
  query: ListTasksQuery,
  now: Date = new Date(),
): Promise<TaskDto[]> {
  const board = isBoard(ctx);
  if (!board && !ctx.roles.includes("pole_lead")) throw forbidden();
  if (query.board === "board" && !board) throw forbidden();
  if (query.board && query.board !== "board") await getPole(ctx, query.board);
  const rows = await findManagedTasks(ctx.db, {
    withBoard: board && (!query.board || query.board === "board"),
    poleIds: !query.board ? "all" : query.board === "board" ? [] : [query.board],
    status: query.status,
    assigneeUserId: query.assigneeUserId,
    lateOn: query.late === "true" ? parisDate(now) : undefined,
    q: query.q || undefined,
  });
  return toDtos(ctx, rows);
}

// --- Detail ---

const FIELD_LABELS: Record<string, string> = {
  title: "titre",
  description: "description",
  status: "statut",
  priority: "priorité",
  dueOn: "délai",
};
const STATUS_LABELS: Record<string, string> = { todo: "À faire", doing: "En cours", done: "Fait" };

/** A readable detail of an audit entry, for the history of the task. */
function historyDetail(action: string, payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const names = (key: string) =>
    Array.isArray(payload[key]) ? (payload[key] as unknown[]).map(String).join(", ") : "";
  switch (action) {
    case "task.updated": {
      const parts: string[] = [];
      const fields = Array.isArray(payload.fields) ? payload.fields.map(String) : [];
      const others = fields.filter((f) => f !== "status").map((f) => FIELD_LABELS[f] ?? f);
      if (typeof payload.status === "string") {
        parts.push(`statut → ${STATUS_LABELS[payload.status] ?? payload.status}`);
      }
      if (others.length > 0) parts.push(others.join(", "));
      if (names("assigned")) parts.push(`+ ${names("assigned")}`);
      if (names("unassigned")) parts.push(`− ${names("unassigned")}`);
      return parts.join(" · ") || null;
    }
    case "task.created":
      return names("assigned") ? `assignée à ${names("assigned")}` : null;
    default:
      return typeof payload.name === "string" ? payload.name : null;
  }
}

/** Path on the web origin (the web relays task files: the browser never calls the API). */
export const taskFilePath = (fileName: string) => `/tasks/files/${fileName}`;

export async function getTask(ctx: AuthedCtx, taskId: string): Promise<TaskDetailDto> {
  const { row, rights } = await visibleTask(ctx, taskId);
  const [[card], checklist, comments, attachments, history] = await Promise.all([
    toDtos(ctx, [row]),
    findChecklist(ctx.db, row.task.id),
    findComments(ctx.db, row.task.id),
    findAttachments(ctx.db, row.task.id),
    findHistory(ctx.db, row.task.id),
  ]);
  if (!card) throw notFound();
  return {
    ...card,
    checklistItems: checklist,
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      author: c.authorUserId && c.authorName ? { id: c.authorUserId, name: c.authorName } : null,
      createdAt: c.createdAt.toISOString(),
      canDelete: rights.canEdit || c.authorUserId === ctx.user.id,
    })),
    attachments: attachments.map(({ attachment: a, uploaderName }) => ({
      id: a.id,
      name: a.originalName,
      contentType: a.contentType as TaskFileType,
      sizeBytes: a.sizeBytes,
      url: taskFilePath(a.fileName),
      uploadedBy: a.uploadedBy && uploaderName ? { id: a.uploadedBy, name: uploaderName } : null,
      createdAt: a.createdAt.toISOString(),
      canDelete: rights.canEdit || (rights.canContribute && a.uploadedBy === ctx.user.id),
    })),
    history: history.map((h) => ({
      id: h.id,
      action: h.action,
      actor: h.actorId && h.actorName ? { id: h.actorId, name: h.actorName } : null,
      detail: historyDetail(h.action, h.payload),
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

// --- Creation ---

async function create(
  ctx: AuthedCtx,
  owned: Owned,
  input: CreatePersonalTaskData & {
    assigneeMembershipIds?: string[];
  },
) {
  const { assigneeMembershipIds = [], ...fields } = input;
  const { ids, people } = await checkAssignees(ctx.db, assigneeMembershipIds, owned);
  const id = await inTransaction(ctx.db, async (tx) => {
    const taskId = await insertTask(tx, { ...fields, ...owned, createdBy: ctx.user.id });
    await setAssignees(tx, taskId, ids, ctx.user.id);
    await audit(tx, ctx, taskId, "task.created", {
      title: fields.title,
      scope: owned.scope,
      poleId: owned.poleId,
      ...(ids.length > 0 ? { assigned: [...people.values()].map((p) => p.name) } : {}),
    });
    return taskId;
  });
  return getTask(ctx, id);
}

export async function createTask(ctx: AuthedCtx, poleId: string, input: CreateTaskData) {
  await getPole(ctx, poleId);
  const owned: Owned = { scope: "pole", poleId, ownerUserId: null };
  if (!canManage(ctx, owned)) throw forbidden();
  return create(ctx, owned, input);
}

export async function createBoardTask(ctx: AuthedCtx, input: CreateTaskData) {
  const owned: Owned = { scope: "board", poleId: null, ownerUserId: null };
  if (!canManage(ctx, owned)) throw forbidden();
  return create(ctx, owned, input);
}

/** Personal tasks are for the BDE members of the year, like the task boards. */
export async function createPersonalTask(ctx: AuthedCtx, input: CreatePersonalTaskData) {
  if (ctx.memberships.length === 0) {
    throw new AppError("FORBIDDEN", 403, "Les tâches sont réservées aux membres du BDE.");
  }
  return create(ctx, { scope: "personal", poleId: null, ownerUserId: ctx.user.id }, input);
}

// --- Update and deletion ---

/** Organisers change anything; assignees may only move the status. */
export async function updateTask(ctx: AuthedCtx, taskId: string, input: UpdateTaskData) {
  const { row, assignees, rights } = await visibleTask(ctx, taskId);
  const { assigneeMembershipIds, ...fields } = input;
  const changed = (Object.keys(fields) as (keyof typeof fields)[]).filter(
    (key) => fields[key] !== undefined && fields[key] !== row.task[key],
  );
  const onlyStatus = assigneeMembershipIds === undefined && changed.every((k) => k === "status");
  if (!rights.canEdit && !(rights.canContribute && onlyStatus)) throw forbidden();
  const checked =
    assigneeMembershipIds === undefined
      ? null
      : await checkAssignees(ctx.db, assigneeMembershipIds, row.task);

  await inTransaction(ctx.db, async (tx) => {
    await updateTaskRow(tx, row.task.id, fields);
    const diff = checked ? await setAssignees(tx, row.task.id, checked.ids, ctx.user.id) : null;
    const before = new Map(assignees.map((a) => [a.membershipId, a.user.name]));
    const added = (diff?.added ?? []).flatMap((id) => {
      const person = checked?.people.get(id);
      return person ? [person] : [];
    });
    const assigned = added.map((p) => p.name);
    const unassigned = diff?.removed.map((id) => before.get(id) ?? "?") ?? [];
    if (changed.length === 0 && assigned.length === 0 && unassigned.length === 0) return;
    await audit(tx, ctx, row.task.id, "task.updated", {
      fields: changed,
      ...(changed.includes("status") ? { status: fields.status } : {}),
      ...(assigned.length > 0 ? { assigned } : {}),
      ...(unassigned.length > 0 ? { unassigned } : {}),
    });
  });
  return getTask(ctx, row.task.id);
}

export async function deleteTask(ctx: AuthedCtx, taskId: string, now: Date = new Date()) {
  const { row } = await editableTask(ctx, taskId);
  await inTransaction(ctx.db, async (tx) => {
    await updateTaskRow(tx, row.task.id, { deletedAt: now });
    await audit(tx, ctx, row.task.id, "task.deleted", {
      title: row.task.title,
      scope: row.task.scope,
      poleId: row.task.poleId,
    });
  });
}

// --- Checklist ---

export async function addChecklistItem(ctx: AuthedCtx, taskId: string, label: string) {
  const { row } = await editableTask(ctx, taskId);
  await inTransaction(ctx.db, async (tx) => {
    await lockTask(tx, row.task.id);
    const { countBefore } = await insertChecklistItem(tx, row.task.id, label);
    if (countBefore >= TASK_CHECKLIST_MAX) {
      throw new AppError("TOO_MANY_ITEMS", 422, `${TASK_CHECKLIST_MAX} étapes au plus par tâche.`);
    }
    await audit(tx, ctx, row.task.id, "task.checklist_added", { name: label });
  });
  return getTask(ctx, row.task.id);
}

async function checklistItemOf(ctx: AuthedCtx, itemId: string) {
  const item = await findChecklistItem(ctx.db, itemId);
  if (!item) throw new AppError("NOT_FOUND", 404, "Cette étape n'existe pas.");
  return { item, ...(await visibleTask(ctx, item.taskId)) };
}

/** Organisers rename a step; organisers and assignees tick it. */
export async function updateChecklistItem(
  ctx: AuthedCtx,
  itemId: string,
  input: UpdateChecklistItemData,
) {
  const { item, rights } = await checklistItemOf(ctx, itemId);
  const renaming = input.label !== undefined && input.label !== item.label;
  if (renaming ? !rights.canEdit : !rights.canContribute) throw forbidden();
  await inTransaction(ctx.db, async (tx) => {
    await updateChecklistItemRow(tx, item.id, input);
    if (input.done !== undefined && input.done !== item.done) {
      await audit(
        tx,
        ctx,
        item.taskId,
        input.done ? "task.checklist_checked" : "task.checklist_unchecked",
        { name: input.label ?? item.label },
      );
    }
  });
  return getTask(ctx, item.taskId);
}

export async function deleteChecklistItem(ctx: AuthedCtx, itemId: string) {
  const { item, rights } = await checklistItemOf(ctx, itemId);
  if (!rights.canEdit) throw forbidden();
  await inTransaction(ctx.db, async (tx) => {
    await deleteChecklistItemRow(tx, item.id);
    await audit(tx, ctx, item.taskId, "task.checklist_removed", { name: item.label });
  });
  return getTask(ctx, item.taskId);
}

// --- Comments ---

export async function addComment(ctx: AuthedCtx, taskId: string, body: string) {
  const { row } = await contributableTask(ctx, taskId);
  await insertComment(ctx.db, { taskId: row.task.id, authorUserId: ctx.user.id, body });
  return getTask(ctx, row.task.id);
}

/** The author removes their message; organisers remove any. */
export async function deleteComment(ctx: AuthedCtx, commentId: string, now: Date = new Date()) {
  const comment = await findComment(ctx.db, commentId);
  if (!comment) throw new AppError("NOT_FOUND", 404, "Ce message n'existe pas.");
  const { rights } = await visibleTask(ctx, comment.taskId);
  if (!rights.canEdit && comment.authorUserId !== ctx.user.id) throw forbidden();
  await inTransaction(ctx.db, async (tx) => {
    await softDeleteComment(tx, comment.id, now);
    await audit(tx, ctx, comment.taskId, "task.comment_deleted", {
      commentId: comment.id,
      authorUserId: comment.authorUserId,
    });
  });
  return getTask(ctx, comment.taskId);
}

// --- Files ---

/**
 * Joins a file (photo, PDF, office document, text) to a task, recognised by its bytes. The file
 * is saved first and removed again if the task cannot take it.
 */
export async function addAttachment(
  ctx: AuthedCtx,
  files: TaskFileStore,
  taskId: string,
  file: { name: string; declaredType: string; bytes: Uint8Array },
) {
  if (file.bytes.byteLength === 0 || file.bytes.byteLength > TASK_FILE_MAX_BYTES) {
    throw new AppError("VALIDATION_ERROR", 400, "Un fichier doit faire moins de 10 Mo.");
  }
  const type = sniffTaskFileType(file.bytes, file.declaredType);
  if (!type) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      "Envoie une photo, un PDF, un document Word, Excel ou PowerPoint, un texte ou un CSV.",
    );
  }
  const { row } = await contributableTask(ctx, taskId);
  const fileName = await files.save(file.bytes, type);
  try {
    await inTransaction(ctx.db, async (tx) => {
      await lockTask(tx, row.task.id);
      if ((await countAttachments(tx, row.task.id)) >= TASK_FILES_PER_TASK) {
        throw new AppError(
          "TOO_MANY_ATTACHMENTS",
          422,
          `${TASK_FILES_PER_TASK} fichiers au plus par tâche.`,
        );
      }
      const id = await insertAttachment(tx, {
        taskId: row.task.id,
        fileName,
        originalName: file.name,
        contentType: type,
        sizeBytes: file.bytes.byteLength,
        uploadedBy: ctx.user.id,
      });
      await audit(tx, ctx, row.task.id, "task.attachment_added", {
        attachmentId: id,
        name: file.name,
        contentType: type,
      });
    });
  } catch (error) {
    await files.remove(fileName);
    throw error;
  }
  return getTask(ctx, row.task.id);
}

/** Organisers remove any file; an assignee removes the files they joined. */
export async function removeAttachment(ctx: AuthedCtx, files: TaskFileStore, attachmentId: string) {
  const attachment = await findAttachment(ctx.db, attachmentId);
  if (!attachment) throw new AppError("NOT_FOUND", 404, "Ce fichier n'existe pas.");
  const { rights } = await visibleTask(ctx, attachment.taskId);
  const own = rights.canContribute && attachment.uploadedBy === ctx.user.id;
  if (!rights.canEdit && !own) throw forbidden();
  await inTransaction(ctx.db, async (tx) => {
    await deleteAttachment(tx, attachment.id);
    await audit(tx, ctx, attachment.taskId, "task.attachment_removed", {
      attachmentId: attachment.id,
      name: attachment.originalName,
    });
  });
  await files.remove(attachment.fileName);
  return getTask(ctx, attachment.taskId);
}

/** The bytes of a task file, for whoever sees the task. */
export async function readAttachment(ctx: AuthedCtx, files: TaskFileStore, fileName: string) {
  const attachment = await findAttachmentByFileName(ctx.db, fileName);
  if (!attachment) throw new AppError("NOT_FOUND", 404, "Ce fichier n'existe pas.");
  await visibleTask(ctx, attachment.taskId);
  const file = await files.read(attachment.fileName);
  if (!file) throw new AppError("NOT_FOUND", 404, "Ce fichier n'existe pas.");
  return { ...file, name: attachment.originalName };
}
