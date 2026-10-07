import {
  AdjustOpenPointsInput,
  DecideOpenPointsInput,
  DecideOpenPointsResultDto,
  LedgerEntryDto,
  ListLedgerQuery,
  MyOpenPointsDto,
  OpenPointsAccountDto,
  OpenPointsMovementDto,
  SearchAccountsQuery,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse, paginated } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  adjustOpenPoints,
  decideOpenPoints,
  getMyOpenPoints,
  listLedger,
  searchAccounts,
} from "./open-points.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

const myRoute = createRoute({
  method: "get",
  path: "/me/open-points",
  tags: ["open-points"],
  middleware: [requireAuth] as const,
  responses: {
    200: json(MyOpenPointsDto, "Mon solde et mes mouvements de l'année en cours"),
    401: errorResponse("Pas de session"),
  },
});

const ledgerRoute = createRoute({
  method: "get",
  path: "/open-points",
  tags: ["open-points"],
  middleware: [requirePermission("open-points:validate")] as const,
  request: { query: ListLedgerQuery },
  responses: {
    200: json(paginated(LedgerEntryDto), "Mouvements de l'année en cours"),
    403: errorResponse("Réservé au bureau"),
  },
});

const decideRoute = (action: "validate" | "reject") =>
  createRoute({
    method: "post",
    path: `/open-points/${action}`,
    tags: ["open-points"],
    middleware: [requirePermission("open-points:validate")] as const,
    request: { body: { content: { "application/json": { schema: DecideOpenPointsInput } } } },
    responses: {
      200: json(
        DecideOpenPointsResultDto,
        action === "validate" ? "Mouvements validés" : "Mouvements rejetés",
      ),
      400: errorResponse("Données invalides"),
      403: errorResponse("Réservé au bureau"),
    },
  });

const adjustRoute = createRoute({
  method: "post",
  path: "/open-points/adjustments",
  tags: ["open-points"],
  middleware: [requirePermission("open-points:adjust")] as const,
  request: { body: { content: { "application/json": { schema: AdjustOpenPointsInput } } } },
  responses: {
    201: json(OpenPointsMovementDto, "Ajustement enregistré (validé)"),
    400: errorResponse("Données invalides"),
    403: errorResponse("Réservé au bureau"),
    404: errorResponse("Étudiant introuvable"),
    422: errorResponse("MANUAL_ADJUSTMENT_REQUIRES_REASON ou MEMBERS_HAVE_NO_OPEN_POINTS"),
  },
});

const accountsRoute = createRoute({
  method: "get",
  path: "/open-points/accounts",
  tags: ["open-points"],
  middleware: [requirePermission("open-points:adjust")] as const,
  request: { query: SearchAccountsQuery },
  responses: {
    200: json(z.array(OpenPointsAccountDto), "Étudiants et soldes"),
    403: errorResponse("Réservé au bureau"),
  },
});

export function createOpenPointsRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(myRoute, async (c) => c.json(await getMyOpenPoints(authedCtx(c.get("ctx"))), 200))
    .openapi(ledgerRoute, async (c) =>
      c.json(await listLedger(authedCtx(c.get("ctx")), c.req.valid("query")), 200),
    )
    .openapi(decideRoute("validate"), async (c) =>
      c.json(
        await decideOpenPoints(authedCtx(c.get("ctx")), c.req.valid("json").ids, "validated"),
        200,
      ),
    )
    .openapi(decideRoute("reject"), async (c) =>
      c.json(
        await decideOpenPoints(authedCtx(c.get("ctx")), c.req.valid("json").ids, "rejected"),
        200,
      ),
    )
    .openapi(adjustRoute, async (c) =>
      c.json(await adjustOpenPoints(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(accountsRoute, async (c) =>
      c.json(await searchAccounts(authedCtx(c.get("ctx")), c.req.valid("query").q), 200),
    );
}
