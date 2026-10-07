import {
  CheckinCandidateDto,
  CheckinDto,
  CheckinInput,
  CheckinSearchQuery,
  CheckinStatsDto,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import { rateLimitPerUser } from "../../core/rate-limit";
import { checkinStats, recordCheckin, searchCheckinCandidates } from "./checkin.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const EventIdParams = z.object({ eventId: z.uuid() });

const checkinRoute = createRoute({
  method: "post",
  path: "/events/{eventId}/checkin",
  tags: ["checkin"],
  middleware: [
    requirePermission("checkin:scan"),
    // A scanner does about one scan per second at the door.
    rateLimitPerUser({ windowMs: 60_000, max: 120 }),
  ] as const,
  request: {
    params: EventIdParams,
    body: { content: { "application/json": { schema: CheckinInput } } },
  },
  responses: {
    201: json(CheckinDto, "Entrée enregistrée"),
    403: errorResponse("Pas le droit de pointer cet événement"),
    404: errorResponse("Événement introuvable"),
    409: errorResponse("ALREADY_CHECKED_IN (détails : heure du premier pointage)"),
    422: errorResponse("TICKET_NOT_VALID : billet inconnu, d'un autre événement ou annulé"),
    429: errorResponse("Trop de scans"),
  },
});

const searchRoute = createRoute({
  method: "get",
  path: "/events/{eventId}/checkin/search",
  tags: ["checkin"],
  middleware: [requirePermission("checkin:scan")] as const,
  request: { params: EventIdParams, query: CheckinSearchQuery },
  responses: {
    200: json(z.array(CheckinCandidateDto), "Inscrits correspondant à la recherche"),
    403: errorResponse("Pas le droit de pointer cet événement"),
  },
});

const statsRoute = createRoute({
  method: "get",
  path: "/events/{eventId}/checkin/stats",
  tags: ["checkin"],
  middleware: [requirePermission("checkin:scan")] as const,
  request: { params: EventIdParams },
  responses: {
    200: json(CheckinStatsDto, "Inscrits et entrées"),
    403: errorResponse("Pas le droit de pointer cet événement"),
  },
});

export function createCheckinRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(checkinRoute, async (c) =>
      c.json(
        await recordCheckin(
          authedCtx(c.get("ctx")),
          c.req.valid("param").eventId,
          c.req.valid("json"),
        ),
        201,
      ),
    )
    .openapi(searchRoute, async (c) =>
      c.json(
        await searchCheckinCandidates(
          authedCtx(c.get("ctx")),
          c.req.valid("param").eventId,
          c.req.valid("query").q,
        ),
        200,
      ),
    )
    .openapi(statsRoute, async (c) =>
      c.json(await checkinStats(authedCtx(c.get("ctx")), c.req.valid("param").eventId), 200),
    );
}
