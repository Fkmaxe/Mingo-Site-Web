import {
  CreatePersonalTaskInput,
  CreateTaskInput,
  PoleMemberDto,
  TaskDto,
  UpdateTaskInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  createBoardTask,
  createPersonalTask,
  createTask,
  deleteTask,
  listBoardMembers,
  listBoardTasks,
  listMyTasks,
  listPoleTasks,
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
  responses: { 201: json(TaskDto, "Tâche perso créée"), ...errors },
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
  responses: { 201: json(TaskDto, "Tâche du bureau créée"), ...errors },
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
  responses: { 201: json(TaskDto, "Tâche créée"), ...errors },
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
  responses: { 200: json(TaskDto, "Tâche modifiée"), ...errors },
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

export function createTasksRouter() {
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
    .openapi(updateRoute, async (c) =>
      c.json(
        await updateTask(authedCtx(c.get("ctx")), c.req.valid("param").taskId, c.req.valid("json")),
        200,
      ),
    )
    .openapi(deleteRoute, async (c) => {
      await deleteTask(authedCtx(c.get("ctx")), c.req.valid("param").taskId);
      return c.body(null, 204);
    });
}
