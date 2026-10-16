import {
  CreateTournamentInput,
  EventLeagueDto,
  LeagueDto,
  LeagueQuery,
  LeagueSeasonInput,
  MatchLiveInput,
  MyLeagueDto,
  RecordMatchInput,
  SetLeagueSportInput,
  SportInput,
  ValidateLeagueResultsInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse, jsonBody, jsonResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  createSport,
  createTournament,
  drawBracket,
  editSport,
  getEventLeague,
  getLeague,
  getMyLeague,
  recordMatch,
  removeTournament,
  saveSeason,
  setLeagueSport,
  setMatchLive,
  validateResults,
} from "./league.service";

const Id = z.object({ id: z.uuid() });
const EventRef = z.object({ eventRef: z.string().min(1) });
const EventId = z.object({ eventId: z.uuid() });

const seasonErrors = {
  400: errorResponse("Entrée invalide"),
  401: errorResponse("Pas de session"),
  403: errorResponse("Réservé au bureau"),
  404: errorResponse("Introuvable"),
  409: errorResponse("ALREADY_EXISTS"),
  422: errorResponse("NO_CURRENT_SCHOOL_YEAR"),
};
const eventErrors = {
  400: errorResponse("Entrée invalide, DRAW_NOT_ALLOWED, PLACE_OUT_OF_SCALE"),
  401: errorResponse("Pas de session"),
  403: errorResponse("Pas organisateur de cet événement"),
  404: errorResponse("Événement, tournoi ou match introuvable"),
  409: errorResponse(
    "TOURNAMENT_EXISTS, BRACKET_EXISTS, POOLS_NOT_FINISHED, MATCH_LOCKED, MATCH_NOT_READY, NOT_A_LEAGUE_EVENT",
  ),
  422: errorResponse("INVALID_TOURNAMENT, NOT_A_PARTICIPANT, NO_CURRENT_SCHOOL_YEAR"),
};

const leagueRoute = createRoute({
  method: "get",
  path: "/league",
  tags: ["league"],
  middleware: [requireAuth] as const,
  request: { query: LeagueQuery },
  responses: {
    200: jsonResponse(LeagueDto, "Saison, classement général et résultats"),
    401: errorResponse("Pas de session"),
    422: errorResponse("NO_CURRENT_SCHOOL_YEAR"),
  },
});

const myLeagueRoute = createRoute({
  method: "get",
  path: "/league/me",
  tags: ["league"],
  middleware: [requireAuth] as const,
  responses: {
    200: jsonResponse(MyLeagueDto, "Rang, points et événements de la personne connectée"),
    401: errorResponse("Pas de session"),
  },
});

const saveSeasonRoute = createRoute({
  method: "put",
  path: "/league",
  tags: ["league"],
  middleware: [requirePermission("league:manage")] as const,
  request: jsonBody(LeagueSeasonInput),
  responses: { 200: jsonResponse(LeagueDto, "Réglages enregistrés"), ...seasonErrors },
});

const createSportRoute = createRoute({
  method: "post",
  path: "/league/sports",
  tags: ["league"],
  middleware: [requirePermission("league:manage")] as const,
  request: jsonBody(SportInput),
  responses: { 200: jsonResponse(LeagueDto, "Sport ajouté"), ...seasonErrors },
});

const editSportRoute = createRoute({
  method: "put",
  path: "/league/sports/{id}",
  tags: ["league"],
  middleware: [requirePermission("league:manage")] as const,
  request: { params: Id, ...jsonBody(SportInput) },
  responses: { 200: jsonResponse(LeagueDto, "Sport renommé"), ...seasonErrors },
});

const eventLeagueRoute = createRoute({
  method: "get",
  path: "/events/{eventRef}/league",
  tags: ["league"],
  middleware: [requireAuth] as const,
  request: { params: EventRef },
  responses: {
    200: jsonResponse(EventLeagueDto, "Ligue, tournoi et résultats de l'événement"),
    401: errorResponse("Pas de session"),
    404: errorResponse("Événement introuvable"),
    422: errorResponse("NO_CURRENT_SCHOOL_YEAR"),
  },
});

const eventWrite = <M extends "post" | "put" | "delete">(
  method: M,
  path: string,
  description: string,
  schema?: z.ZodType,
) =>
  createRoute({
    method,
    path,
    tags: ["league"],
    middleware: [requirePermission("events:update")] as const,
    request: schema ? { params: EventId, ...jsonBody(schema) } : { params: EventId },
    responses: { 200: jsonResponse(EventLeagueDto, description), ...eventErrors },
  });

const setSportRoute = eventWrite(
  "put",
  "/events/{eventId}/league",
  "Sport de ligue enregistré",
  SetLeagueSportInput,
);
const createTournamentRoute = eventWrite(
  "post",
  "/events/{eventId}/tournament",
  "Tournoi créé, poules ou arbre tirés",
  CreateTournamentInput,
);
const deleteTournamentRoute = eventWrite(
  "delete",
  "/events/{eventId}/tournament",
  "Tournoi supprimé",
);
const drawBracketRoute = eventWrite(
  "post",
  "/events/{eventId}/tournament/bracket",
  "Arbre tiré depuis les poules",
);
const validateRoute = eventWrite(
  "post",
  "/events/{eventId}/league/results",
  "Classement validé, points de ligue écrits",
  ValidateLeagueResultsInput,
);

const recordMatchRoute = createRoute({
  method: "put",
  path: "/tournament-matches/{id}",
  tags: ["league"],
  middleware: [requirePermission("events:update")] as const,
  request: { params: Id, ...jsonBody(RecordMatchInput) },
  responses: { 200: jsonResponse(EventLeagueDto, "Résultat enregistré"), ...eventErrors },
});

const matchLiveRoute = createRoute({
  method: "put",
  path: "/tournament-matches/{id}/live",
  tags: ["league"],
  middleware: [requirePermission("events:update")] as const,
  request: { params: Id, ...jsonBody(MatchLiveInput) },
  responses: { 200: jsonResponse(EventLeagueDto, "Match lancé ou arrêté"), ...eventErrors },
});

export function createLeagueRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(leagueRoute, async (c) =>
      c.json(await getLeague(c.get("ctx"), c.req.valid("query")), 200),
    )
    .openapi(myLeagueRoute, async (c) => c.json(await getMyLeague(authedCtx(c.get("ctx"))), 200))
    .openapi(saveSeasonRoute, async (c) =>
      c.json(
        await saveSeason(authedCtx(c.get("ctx")), LeagueSeasonInput.parse(await c.req.json())),
        200,
      ),
    )
    .openapi(createSportRoute, async (c) =>
      c.json(
        await createSport(authedCtx(c.get("ctx")), SportInput.parse(await c.req.json()).name),
        200,
      ),
    )
    .openapi(editSportRoute, async (c) =>
      c.json(
        await editSport(
          authedCtx(c.get("ctx")),
          c.req.valid("param").id,
          SportInput.parse(await c.req.json()).name,
        ),
        200,
      ),
    )
    .openapi(eventLeagueRoute, async (c) =>
      c.json(await getEventLeague(authedCtx(c.get("ctx")), c.req.valid("param").eventRef), 200),
    )
    .openapi(setSportRoute, async (c) =>
      c.json(
        await setLeagueSport(
          authedCtx(c.get("ctx")),
          c.req.valid("param").eventId,
          SetLeagueSportInput.parse(await c.req.json()).sportId,
        ),
        200,
      ),
    )
    .openapi(createTournamentRoute, async (c) =>
      c.json(
        await createTournament(
          authedCtx(c.get("ctx")),
          c.req.valid("param").eventId,
          CreateTournamentInput.parse(await c.req.json()),
        ),
        200,
      ),
    )
    .openapi(deleteTournamentRoute, async (c) =>
      c.json(await removeTournament(authedCtx(c.get("ctx")), c.req.valid("param").eventId), 200),
    )
    .openapi(drawBracketRoute, async (c) =>
      c.json(await drawBracket(authedCtx(c.get("ctx")), c.req.valid("param").eventId), 200),
    )
    .openapi(recordMatchRoute, async (c) =>
      c.json(
        await recordMatch(
          authedCtx(c.get("ctx")),
          c.req.valid("param").id,
          RecordMatchInput.parse(await c.req.json()),
        ),
        200,
      ),
    )
    .openapi(matchLiveRoute, async (c) =>
      c.json(
        await setMatchLive(
          authedCtx(c.get("ctx")),
          c.req.valid("param").id,
          c.req.valid("json").live,
        ),
        200,
      ),
    )
    .openapi(validateRoute, async (c) =>
      c.json(
        await validateResults(
          authedCtx(c.get("ctx")),
          c.req.valid("param").eventId,
          ValidateLeagueResultsInput.parse(await c.req.json()),
        ),
        200,
      ),
    );
}
