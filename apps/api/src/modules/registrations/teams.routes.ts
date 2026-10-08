import { CreateTeamInput, JoinTeamInput, TeamDto } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import { createTeam, getMyTeam, joinTeam, listTeams } from "./teams.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

const EventIdParams = z.object({ eventId: z.uuid() });

const createTeamRoute = createRoute({
  method: "post",
  path: "/events/{eventId}/teams",
  tags: ["teams"],
  middleware: [requirePermission("events:register")] as const,
  request: {
    params: EventIdParams,
    body: { content: { "application/json": { schema: CreateTeamInput } }, required: true },
  },
  responses: {
    201: json(TeamDto, "Équipe créée, capitaine inscrit·e"),
    400: errorResponse("Nom ou réponses invalides"),
    401: errorResponse("Pas de session"),
    404: errorResponse("Événement introuvable"),
    409: errorResponse(
      "NOT_TEAM_EVENT, TEAM_NAME_TAKEN, ALREADY_REGISTERED, DEADLINE_PASSED ou REGISTRATION_CLOSED",
    ),
  },
});

const joinTeamRoute = createRoute({
  method: "post",
  path: "/events/{eventId}/teams/join",
  tags: ["teams"],
  middleware: [requirePermission("events:register")] as const,
  request: {
    params: EventIdParams,
    body: { content: { "application/json": { schema: JoinTeamInput } }, required: true },
  },
  responses: {
    201: json(TeamDto, "Équipe rejointe, inscription créée"),
    400: errorResponse("Code ou réponses invalides"),
    401: errorResponse("Pas de session"),
    404: errorResponse("Événement ou équipe introuvable"),
    409: errorResponse(
      "NOT_TEAM_EVENT, TEAM_FULL, ALREADY_REGISTERED, DEADLINE_PASSED ou REGISTRATION_CLOSED",
    ),
  },
});

const myTeamRoute = createRoute({
  method: "get",
  path: "/events/{eventId}/teams/mine",
  tags: ["teams"],
  middleware: [requireAuth] as const,
  request: { params: EventIdParams },
  responses: {
    200: json(TeamDto, "Mon équipe pour cet événement"),
    401: errorResponse("Pas de session"),
    404: errorResponse("Événement introuvable ou pas d'équipe"),
    409: errorResponse("NOT_TEAM_EVENT"),
  },
});

const teamsRoute = createRoute({
  method: "get",
  path: "/events/{eventId}/teams",
  tags: ["teams"],
  middleware: [requirePermission("registrations:read")] as const,
  request: { params: EventIdParams },
  responses: {
    200: json(z.array(TeamDto), "Équipes de l'événement"),
    403: errorResponse("Pas le droit de voir les équipes de cet événement"),
    404: errorResponse("Événement introuvable"),
  },
});

export function createTeamsRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(createTeamRoute, async (c) =>
      c.json(
        await createTeam(
          authedCtx(c.get("ctx")),
          c.req.valid("param").eventId,
          c.req.valid("json"),
        ),
        201,
      ),
    )
    .openapi(joinTeamRoute, async (c) =>
      c.json(
        await joinTeam(authedCtx(c.get("ctx")), c.req.valid("param").eventId, c.req.valid("json")),
        201,
      ),
    )
    .openapi(myTeamRoute, async (c) =>
      c.json(await getMyTeam(authedCtx(c.get("ctx")), c.req.valid("param").eventId), 200),
    )
    .openapi(teamsRoute, async (c) =>
      c.json(await listTeams(authedCtx(c.get("ctx")), c.req.valid("param").eventId), 200),
    );
}
