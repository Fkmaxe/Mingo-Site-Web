import { ClassesDto, ClassLevelInput, TrackInput } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import { createLevel, createTrack, editLevel, editTrack, listClasses } from "./classes.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } }, required: true },
});
const Id = z.object({ id: z.uuid() });
const writeErrors = {
  400: errorResponse("Nom invalide"),
  401: errorResponse("Pas de session"),
  403: errorResponse("Réservé aux administrateurs"),
  404: errorResponse("Introuvable"),
  409: errorResponse("ALREADY_EXISTS"),
};

const listRoute = createRoute({
  method: "get",
  path: "/classes",
  tags: ["classes"],
  middleware: [requireAuth] as const,
  responses: { 200: json(ClassesDto, "Niveaux et filières"), 401: errorResponse("Pas de session") },
});

const route = <M extends "post" | "put">(
  method: M,
  path: string,
  schema: z.ZodType,
  withId: boolean,
) =>
  createRoute({
    method,
    path,
    tags: ["classes"],
    middleware: [requirePermission("settings:manage")] as const,
    request: withId ? { params: Id, ...body(schema) } : body(schema),
    responses: { 200: json(ClassesDto, "Niveaux et filières"), ...writeErrors },
  });

const createLevelRoute = route("post", "/admin/levels", ClassLevelInput, false);
const editLevelRoute = route("put", "/admin/levels/{id}", ClassLevelInput, true);
const createTrackRoute = route("post", "/admin/tracks", TrackInput, false);
const editTrackRoute = route("put", "/admin/tracks/{id}", TrackInput, true);

export function createClassesRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(listRoute, async (c) => c.json(await listClasses(c.get("ctx")), 200))
    .openapi(createLevelRoute, async (c) =>
      c.json(
        await createLevel(authedCtx(c.get("ctx")), ClassLevelInput.parse(await c.req.json())),
        200,
      ),
    )
    .openapi(editLevelRoute, async (c) =>
      c.json(
        await editLevel(
          authedCtx(c.get("ctx")),
          Id.parse(c.req.param()).id,
          ClassLevelInput.parse(await c.req.json()),
        ),
        200,
      ),
    )
    .openapi(createTrackRoute, async (c) =>
      c.json(
        await createTrack(authedCtx(c.get("ctx")), TrackInput.parse(await c.req.json()).name),
        200,
      ),
    )
    .openapi(editTrackRoute, async (c) =>
      c.json(
        await editTrack(
          authedCtx(c.get("ctx")),
          Id.parse(c.req.param()).id,
          TrackInput.parse(await c.req.json()).name,
        ),
        200,
      ),
    );
}
