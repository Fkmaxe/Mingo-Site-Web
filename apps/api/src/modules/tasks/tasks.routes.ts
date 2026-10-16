import {
  ChecklistItemInput,
  CreatePersonalTaskInput,
  CreateTaskInput,
  DOCUMENT_FILE_TYPES,
  ListTasksQuery,
  PoleMemberDto,
  TaskCommentInput,
  TaskDetailDto,
  TaskDto,
  TaskFileUploadQuery,
  UpdateChecklistItemInput,
  UpdateTaskInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import type { DocumentStore } from "../../lib/storage";
import {
  addAttachment,
  addChecklistItem,
  addComment,
  createBoardTask,
  createPersonalTask,
  createTask,
  deleteChecklistItem,
  deleteComment,
  deleteTask,
  getTask,
  listBoardMembers,
  listBoardTasks,
  listManagedTasks,
  listMyTasks,
  listPoleTasks,
  readAttachment,
  removeAttachment,
  updateChecklistItem,
  updateTask,
} from "./tasks.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const errors = {
  400: errorResponse("Données invalides"),
  401: errorResponse("Pas de session"),
  403: errorResponse("Pas le droit"),
  404: errorResponse("Introuvable"),
};
const PoleParams = z.object({ poleId: z.uuid() });
const TaskParams = z.object({ taskId: z.uuid() });
const ItemParams = z.object({ itemId: z.uuid() });
const CommentParams = z.object({ commentId: z.uuid() });
const AttachmentParams = z.object({ attachmentId: z.uuid() });
const Binary = z.string().meta({ format: "binary" });
const jsonBody = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});

// Pole-level rights (member of the pole, lead of the pole, assignee, author of a personal task)
// are checked in the service.
const listRoute = createRoute({
  method: "get",
  path: "/poles/{poleId}/tasks",
  tags: ["tasks"],
  middleware: [requirePermission("members:read")] as const,
  request: { params: PoleParams },
  responses: { 200: json(z.array(TaskDto), "Tâches du pôle"), ...errors },
});
const mineRoute = createRoute({
  method: "get",
  path: "/me/tasks",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  responses: { 200: json(z.array(TaskDto), "Mes tâches : assignées et perso"), ...errors },
});
const createPersonalRoute = createRoute({
  method: "post",
  path: "/me/tasks",
  tags: ["tasks"],
  // Members of the year only: checked in the service.
  middleware: [requireAuth] as const,
  request: { body: { content: { "application/json": { schema: CreatePersonalTaskInput } } } },
  responses: { 201: json(TaskDetailDto, "Tâche perso créée"), ...errors },
});
const boardListRoute = createRoute({
  method: "get",
  path: "/board/tasks",
  tags: ["tasks"],
  middleware: [requirePermission("poles:all")] as const,
  responses: { 200: json(z.array(TaskDto), "Tâches du bureau"), ...errors },
});
const boardCreateRoute = createRoute({
  method: "post",
  path: "/board/tasks",
  tags: ["tasks"],
  middleware: [requirePermission("poles:all")] as const,
  request: { body: { content: { "application/json": { schema: CreateTaskInput } } } },
  responses: { 201: json(TaskDetailDto, "Tâche du bureau créée"), ...errors },
});
const boardMembersRoute = createRoute({
  method: "get",
  path: "/board/members",
  tags: ["tasks"],
  middleware: [requirePermission("poles:all")] as const,
  responses: { 200: json(z.array(PoleMemberDto), "Membres du bureau de l'année"), ...errors },
});
const createTaskRoute = createRoute({
  method: "post",
  path: "/poles/{poleId}/tasks",
  tags: ["tasks"],
  middleware: [requirePermission("tasks:manage")] as const,
  request: {
    params: PoleParams,
    body: { content: { "application/json": { schema: CreateTaskInput } } },
  },
  responses: { 201: json(TaskDetailDto, "Tâche créée"), ...errors },
});
const managedRoute = createRoute({
  method: "get",
  path: "/tasks",
  tags: ["tasks"],
  // Bureau or pole lead: checked in the service.
  middleware: [requirePermission("tasks:manage")] as const,
  request: { query: ListTasksQuery },
  responses: { 200: json(z.array(TaskDto), "Tâches du bureau et des pôles"), ...errors },
});
const getRoute = createRoute({
  method: "get",
  path: "/tasks/{taskId}",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  request: { params: TaskParams },
  responses: { 200: json(TaskDetailDto, "Tâche détaillée"), ...errors },
});
const updateRoute = createRoute({
  method: "patch",
  path: "/tasks/{taskId}",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  request: {
    params: TaskParams,
    body: { content: { "application/json": { schema: UpdateTaskInput } } },
  },
  responses: { 200: json(TaskDetailDto, "Tâche modifiée"), ...errors },
});
const deleteRoute = createRoute({
  method: "delete",
  path: "/tasks/{taskId}",
  tags: ["tasks"],
  // The author of a personal task deletes it without tasks:manage: checked in the service.
  middleware: [requireAuth] as const,
  request: { params: TaskParams },
  responses: { 204: { description: "Tâche supprimée" }, ...errors },
});

// Organisers, assignees, authors: checked in the service.
const checklistAddRoute = createRoute({
  method: "post",
  path: "/tasks/{taskId}/checklist",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  request: { params: TaskParams, ...jsonBody(ChecklistItemInput) },
  responses: { 201: json(TaskDetailDto, "Étape ajoutée"), ...errors },
});
const checklistUpdateRoute = createRoute({
  method: "patch",
  path: "/tasks/checklist/{itemId}",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  request: { params: ItemParams, ...jsonBody(UpdateChecklistItemInput) },
  responses: { 200: json(TaskDetailDto, "Étape modifiée"), ...errors },
});
const checklistDeleteRoute = createRoute({
  method: "delete",
  path: "/tasks/checklist/{itemId}",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  request: { params: ItemParams },
  responses: { 200: json(TaskDetailDto, "Étape retirée"), ...errors },
});
const commentAddRoute = createRoute({
  method: "post",
  path: "/tasks/{taskId}/comments",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  request: { params: TaskParams, ...jsonBody(TaskCommentInput) },
  responses: { 201: json(TaskDetailDto, "Message ajouté"), ...errors },
});
const commentDeleteRoute = createRoute({
  method: "delete",
  path: "/tasks/comments/{commentId}",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  request: { params: CommentParams },
  responses: { 200: json(TaskDetailDto, "Message retiré"), ...errors },
});
const attachmentUploadRoute = createRoute({
  method: "post",
  path: "/tasks/{taskId}/attachments",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  request: {
    params: TaskParams,
    query: TaskFileUploadQuery,
    body: {
      content: Object.fromEntries(DOCUMENT_FILE_TYPES.map((t) => [t, { schema: Binary }])),
      required: true,
      description: "Le fichier lui-même, 10 Mo au plus",
    },
  },
  responses: { 201: json(TaskDetailDto, "Fichier joint"), ...errors },
});
const attachmentDeleteRoute = createRoute({
  method: "delete",
  path: "/tasks/attachments/{attachmentId}",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  request: { params: AttachmentParams },
  responses: { 200: json(TaskDetailDto, "Fichier retiré"), ...errors },
});
const attachmentFileRoute = createRoute({
  method: "get",
  path: "/tasks/files/{name}",
  tags: ["tasks"],
  middleware: [requireAuth] as const,
  request: { params: z.object({ name: z.string().max(64) }) },
  responses: {
    200: {
      content: Object.fromEntries(DOCUMENT_FILE_TYPES.map((t) => [t, { schema: Binary }])),
      description: "Fichier de la tâche",
    },
    ...errors,
  },
});

/** Photos and PDF are shown in the page; other files are downloaded under their name. */
const INLINE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export function createTasksRouter(files: DocumentStore) {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(listRoute, async (c) =>
      c.json(await listPoleTasks(authedCtx(c.get("ctx")), c.req.valid("param").poleId), 200),
    )
    .openapi(mineRoute, async (c) => c.json(await listMyTasks(authedCtx(c.get("ctx"))), 200))
    .openapi(createPersonalRoute, async (c) =>
      c.json(await createPersonalTask(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(boardListRoute, async (c) =>
      c.json(await listBoardTasks(authedCtx(c.get("ctx"))), 200),
    )
    .openapi(boardCreateRoute, async (c) =>
      c.json(await createBoardTask(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(boardMembersRoute, async (c) =>
      c.json(await listBoardMembers(authedCtx(c.get("ctx"))), 200),
    )
    .openapi(createTaskRoute, async (c) =>
      c.json(
        await createTask(authedCtx(c.get("ctx")), c.req.valid("param").poleId, c.req.valid("json")),
        201,
      ),
    )
    .openapi(managedRoute, async (c) =>
      c.json(await listManagedTasks(authedCtx(c.get("ctx")), c.req.valid("query")), 200),
    )
    .openapi(getRoute, async (c) =>
      c.json(await getTask(authedCtx(c.get("ctx")), c.req.valid("param").taskId), 200),
    )
    .openapi(updateRoute, async (c) =>
      c.json(
        await updateTask(authedCtx(c.get("ctx")), c.req.valid("param").taskId, c.req.valid("json")),
        200,
      ),
    )
    .openapi(deleteRoute, async (c) => {
      await deleteTask(authedCtx(c.get("ctx")), c.req.valid("param").taskId);
      return c.body(null, 204);
    })
    .openapi(checklistAddRoute, async (c) =>
      c.json(
        await addChecklistItem(
          authedCtx(c.get("ctx")),
          c.req.valid("param").taskId,
          c.req.valid("json").label,
        ),
        201,
      ),
    )
    .openapi(checklistUpdateRoute, async (c) =>
      c.json(
        await updateChecklistItem(
          authedCtx(c.get("ctx")),
          c.req.valid("param").itemId,
          c.req.valid("json"),
        ),
        200,
      ),
    )
    .openapi(checklistDeleteRoute, async (c) =>
      c.json(await deleteChecklistItem(authedCtx(c.get("ctx")), c.req.valid("param").itemId), 200),
    )
    .openapi(commentAddRoute, async (c) =>
      c.json(
        await addComment(
          authedCtx(c.get("ctx")),
          c.req.valid("param").taskId,
          c.req.valid("json").body,
        ),
        201,
      ),
    )
    .openapi(commentDeleteRoute, async (c) =>
      c.json(await deleteComment(authedCtx(c.get("ctx")), c.req.valid("param").commentId), 200),
    )
    .openapi(attachmentUploadRoute, async (c) =>
      c.json(
        await addAttachment(authedCtx(c.get("ctx")), files, c.req.valid("param").taskId, {
          name: c.req.valid("query").name,
          declaredType: (c.req.header("content-type") ?? "").split(";")[0]?.trim() ?? "",
          bytes: new Uint8Array(await c.req.arrayBuffer()),
        }),
        201,
      ),
    )
    .openapi(attachmentDeleteRoute, async (c) =>
      c.json(
        await removeAttachment(authedCtx(c.get("ctx")), files, c.req.valid("param").attachmentId),
        200,
      ),
    )
    .openapi(attachmentFileRoute, async (c) => {
      const file = await readAttachment(authedCtx(c.get("ctx")), files, c.req.valid("param").name);
      const disposition = INLINE_TYPES.includes(file.type)
        ? "inline"
        : `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`;
      // Names are random and never reused: the file can be cached for good.
      return new Response(file.bytes, {
        headers: {
          "content-type": file.type,
          "content-disposition": disposition,
          "cache-control": "private, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    });
}
