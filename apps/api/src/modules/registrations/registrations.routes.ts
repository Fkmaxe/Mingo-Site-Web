import { ListRegistrantsQuery, ListTicketsQuery, RegistrantDto, TicketDto } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse, paginated } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  cancelRegistration,
  getTicket,
  listMyTickets,
  listRegistrants,
  register,
} from "./registrations.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

const EventIdParams = z.object({ eventId: z.uuid() });
const RegistrationIdParams = z.object({ registrationId: z.uuid() });

const registerRoute = createRoute({
  method: "post",
  path: "/events/{eventId}/registrations",
  tags: ["registrations"],
  middleware: [requirePermission("events:register")] as const,
  request: { params: EventIdParams },
  responses: {
    201: json(TicketDto, "Inscription confirmée, billet créé"),
    401: errorResponse("Pas de session"),
    404: errorResponse("Événement introuvable"),
    409: errorResponse("ALREADY_REGISTERED, EVENT_FULL, DEADLINE_PASSED ou REGISTRATION_CLOSED"),
  },
});

const registrantsRoute = createRoute({
  method: "get",
  path: "/events/{eventId}/registrations",
  tags: ["registrations"],
  middleware: [requirePermission("registrations:read")] as const,
  request: { params: EventIdParams, query: ListRegistrantsQuery },
  responses: {
    200: json(paginated(RegistrantDto), "Inscrits de l'événement"),
    403: errorResponse("Pas le droit de voir les inscrits de cet événement"),
    404: errorResponse("Événement introuvable"),
  },
});

const myTicketsRoute = createRoute({
  method: "get",
  path: "/me/tickets",
  tags: ["registrations"],
  middleware: [requireAuth] as const,
  request: { query: ListTicketsQuery },
  responses: {
    200: json(z.array(TicketDto), "Mes billets (hors inscriptions annulées)"),
    401: errorResponse("Pas de session"),
  },
});

const ticketRoute = createRoute({
  method: "get",
  path: "/tickets/{registrationId}",
  tags: ["registrations"],
  middleware: [requireAuth] as const,
  request: { params: RegistrationIdParams },
  responses: {
    200: json(TicketDto, "Mon billet"),
    401: errorResponse("Pas de session"),
    404: errorResponse("Billet introuvable"),
  },
});

const cancelRoute = createRoute({
  method: "post",
  path: "/registrations/{registrationId}/cancel",
  tags: ["registrations"],
  middleware: [requireAuth] as const,
  request: { params: RegistrationIdParams },
  responses: {
    200: json(TicketDto, "Inscription annulée"),
    401: errorResponse("Pas de session"),
    404: errorResponse("Inscription introuvable"),
    409: errorResponse("L'événement a commencé"),
  },
});

export function createRegistrationsRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(registerRoute, async (c) =>
      c.json(await register(authedCtx(c.get("ctx")), c.req.valid("param").eventId), 201),
    )
    .openapi(registrantsRoute, async (c) =>
      c.json(
        await listRegistrants(
          authedCtx(c.get("ctx")),
          c.req.valid("param").eventId,
          c.req.valid("query"),
        ),
        200,
      ),
    )
    .openapi(myTicketsRoute, async (c) =>
      c.json(await listMyTickets(authedCtx(c.get("ctx")), c.req.valid("query").scope), 200),
    )
    .openapi(ticketRoute, async (c) =>
      c.json(await getTicket(authedCtx(c.get("ctx")), c.req.valid("param").registrationId), 200),
    )
    .openapi(cancelRoute, async (c) =>
      c.json(
        await cancelRegistration(authedCtx(c.get("ctx")), c.req.valid("param").registrationId),
        200,
      ),
    );
}
