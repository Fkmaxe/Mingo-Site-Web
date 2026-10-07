import { CreateEventInput, EventDto, ListEventsQuery, UpdateEventInput } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse, paginated } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  cancelEvent,
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  publishEvent,
  updateEvent,
} from "./events.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

const EventIdParams = z.object({ eventId: z.uuid() });

const listRoute = createRoute({
  method: "get",
  path: "/events",
  tags: ["events"],
  request: { query: ListEventsQuery },
  responses: { 200: json(paginated(EventDto), "Événements visibles par l'utilisateur") },
});

const getRoute = createRoute({
  method: "get",
  path: "/events/{eventRef}",
  tags: ["events"],
  request: { params: z.object({ eventRef: z.string().min(1) }) },
  responses: {
    200: json(EventDto, "Détail d'un événement (par id ou slug)"),
    404: errorResponse("Événement absent ou invisible"),
  },
});

const createEventRoute = createRoute({
  method: "post",
  path: "/events",
  tags: ["events"],
  middleware: [requirePermission("events:create")] as const,
  request: { body: { content: { "application/json": { schema: CreateEventInput } } } },
  responses: {
    201: json(EventDto, "Événement créé (brouillon)"),
    400: errorResponse("Données invalides"),
    401: errorResponse("Pas de session"),
    403: errorResponse("Pas le droit de créer un événement pour ce pôle"),
  },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/events/{eventId}",
  tags: ["events"],
  middleware: [requirePermission("events:update")] as const,
  request: {
    params: EventIdParams,
    body: { content: { "application/json": { schema: UpdateEventInput } } },
  },
  responses: {
    200: json(EventDto, "Événement modifié"),
    400: errorResponse("Données invalides"),
    403: errorResponse("Pas le droit de modifier cet événement"),
    404: errorResponse("Événement introuvable"),
    409: errorResponse("Événement annulé ou terminé"),
  },
});

const actionRoute = (action: "publish" | "cancel", description: string) =>
  createRoute({
    method: "post",
    path: `/events/{eventId}/${action}`,
    tags: ["events"],
    middleware: [requirePermission("events:update")] as const,
    request: { params: EventIdParams },
    responses: {
      200: json(EventDto, description),
      403: errorResponse("Pas le droit de gérer cet événement"),
      404: errorResponse("Événement introuvable"),
      409: errorResponse("Transition de statut impossible"),
    },
  });

const deleteRoute = createRoute({
  method: "delete",
  path: "/events/{eventId}",
  tags: ["events"],
  middleware: [requirePermission("events:delete")] as const,
  request: { params: EventIdParams },
  responses: {
    204: { description: "Brouillon supprimé" },
    403: errorResponse("Pas le droit de supprimer cet événement"),
    404: errorResponse("Événement introuvable"),
    409: errorResponse("Seul un brouillon peut être supprimé"),
  },
});

export function createEventsRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(listRoute, async (c) =>
      c.json(await listEvents(c.get("ctx"), c.req.valid("query")), 200),
    )
    .openapi(getRoute, async (c) =>
      c.json(await getEvent(c.get("ctx"), c.req.valid("param").eventRef), 200),
    )
    .openapi(createEventRoute, async (c) =>
      c.json(await createEvent(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(updateRoute, async (c) =>
      c.json(
        await updateEvent(
          authedCtx(c.get("ctx")),
          c.req.valid("param").eventId,
          c.req.valid("json"),
        ),
        200,
      ),
    )
    .openapi(actionRoute("publish", "Événement publié"), async (c) =>
      c.json(await publishEvent(authedCtx(c.get("ctx")), c.req.valid("param").eventId), 200),
    )
    .openapi(actionRoute("cancel", "Événement annulé"), async (c) =>
      c.json(await cancelEvent(authedCtx(c.get("ctx")), c.req.valid("param").eventId), 200),
    )
    .openapi(deleteRoute, async (c) => {
      await deleteEvent(authedCtx(c.get("ctx")), c.req.valid("param").eventId);
      return c.body(null, 204);
    });
}
