import { EventStatsDto, MemberInvolvementDto, StatsYearQuery, YearOverviewDto } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import { getEventStats, getMemberInvolvement, getYearOverview } from "./stats.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

const eventStatsRoute = createRoute({
  method: "get",
  path: "/events/{eventId}/stats",
  tags: ["stats"],
  middleware: [requirePermission("registrations:read")] as const,
  request: { params: z.object({ eventId: z.uuid() }) },
  responses: {
    200: json(EventStatsDto, "Chiffres de l'événement"),
    401: errorResponse("Pas de session"),
    403: errorResponse("Pas le droit de gérer cet événement"),
    404: errorResponse("Événement introuvable"),
  },
});

const overviewRoute = createRoute({
  method: "get",
  path: "/stats/overview",
  tags: ["stats"],
  middleware: [requirePermission("stats:read")] as const,
  request: { query: StatsYearQuery },
  responses: {
    200: json(YearOverviewDto, "Vue d'ensemble de l'année"),
    401: errorResponse("Pas de session"),
    403: errorResponse("Réservé au bureau"),
    404: errorResponse("Année scolaire introuvable"),
    422: errorResponse("NO_CURRENT_SCHOOL_YEAR"),
  },
});

const membersRoute = createRoute({
  method: "get",
  path: "/stats/members",
  tags: ["stats"],
  middleware: [requirePermission("stats:read")] as const,
  request: { query: StatsYearQuery },
  responses: {
    200: json(MemberInvolvementDto, "Implication des membres"),
    401: errorResponse("Pas de session"),
    403: errorResponse("Réservé au bureau"),
    404: errorResponse("Année scolaire introuvable"),
    422: errorResponse("NO_CURRENT_SCHOOL_YEAR"),
  },
});

export function createStatsRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(eventStatsRoute, async (c) =>
      c.json(await getEventStats(authedCtx(c.get("ctx")), c.req.valid("param").eventId), 200),
    )
    .openapi(overviewRoute, async (c) =>
      c.json(await getYearOverview(authedCtx(c.get("ctx")), c.req.valid("query")), 200),
    )
    .openapi(membersRoute, async (c) =>
      c.json(await getMemberInvolvement(authedCtx(c.get("ctx")), c.req.valid("query")), 200),
    );
}
