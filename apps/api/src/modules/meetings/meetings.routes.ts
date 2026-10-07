import {
  CreateMeetingInput,
  ListMeetingsQuery,
  MeetingDto,
  SetAttendanceInput,
  UpdateMeetingInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  createMeeting,
  deleteMeeting,
  getMeeting,
  listMeetings,
  setAttendance,
  updateMeeting,
} from "./meetings.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});
const errors = {
  400: errorResponse("Données invalides"),
  401: errorResponse("Pas de session"),
  403: errorResponse("Pas le droit"),
  404: errorResponse("Introuvable"),
};
const Params = z.object({ meetingId: z.uuid() });

const listRoute = createRoute({
  method: "get",
  path: "/meetings",
  tags: ["meetings"],
  middleware: [requirePermission("members:read")] as const,
  request: { query: ListMeetingsQuery },
  responses: { 200: json(z.array(MeetingDto), "Réunions visibles"), ...errors },
});
const getRoute = createRoute({
  method: "get",
  path: "/meetings/{meetingId}",
  tags: ["meetings"],
  middleware: [requirePermission("members:read")] as const,
  request: { params: Params },
  responses: { 200: json(MeetingDto, "Réunion (présences pour l'organisateur)"), ...errors },
});
const createMeetingRoute = createRoute({
  method: "post",
  path: "/meetings",
  tags: ["meetings"],
  middleware: [requirePermission("meetings:manage")] as const,
  request: body(CreateMeetingInput),
  responses: { 201: json(MeetingDto, "Réunion créée"), ...errors },
});
const updateRoute = createRoute({
  method: "patch",
  path: "/meetings/{meetingId}",
  tags: ["meetings"],
  middleware: [requirePermission("meetings:manage")] as const,
  request: { params: Params, ...body(UpdateMeetingInput) },
  responses: { 200: json(MeetingDto, "Réunion modifiée"), ...errors },
});
const deleteRoute = createRoute({
  method: "delete",
  path: "/meetings/{meetingId}",
  tags: ["meetings"],
  middleware: [requirePermission("meetings:manage")] as const,
  request: { params: Params },
  responses: { 204: { description: "Réunion supprimée" }, ...errors },
});
const attendanceRoute = createRoute({
  method: "put",
  path: "/meetings/{meetingId}/attendance",
  tags: ["meetings"],
  middleware: [requirePermission("meetings:manage")] as const,
  request: { params: Params, ...body(SetAttendanceInput) },
  responses: {
    200: json(MeetingDto, "Présence enregistrée"),
    422: errorResponse("Personne non attendue"),
    ...errors,
  },
});

export function createMeetingsRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(listRoute, async (c) =>
      c.json(await listMeetings(authedCtx(c.get("ctx")), c.req.valid("query").scope), 200),
    )
    .openapi(getRoute, async (c) =>
      c.json(await getMeeting(authedCtx(c.get("ctx")), c.req.valid("param").meetingId), 200),
    )
    .openapi(createMeetingRoute, async (c) =>
      c.json(await createMeeting(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(updateRoute, async (c) =>
      c.json(
        await updateMeeting(
          authedCtx(c.get("ctx")),
          c.req.valid("param").meetingId,
          c.req.valid("json"),
        ),
        200,
      ),
    )
    .openapi(deleteRoute, async (c) => {
      await deleteMeeting(authedCtx(c.get("ctx")), c.req.valid("param").meetingId);
      return c.body(null, 204);
    })
    .openapi(attendanceRoute, async (c) =>
      c.json(
        await setAttendance(
          authedCtx(c.get("ctx")),
          c.req.valid("param").meetingId,
          c.req.valid("json"),
        ),
        200,
      ),
    );
}
