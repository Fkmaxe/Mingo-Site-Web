import {
  AcceptApplicationInput,
  ApplicationDto,
  CreateApplicationInput,
  DecideApplicationInput,
  ListApplicationsQuery,
  MyApplicationDto,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  accept,
  apply,
  decide,
  getMyApplication,
  listApplications,
  withdraw,
} from "./applications.service";

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
  409: errorResponse("Déjà candidat, déjà membre ou candidature tranchée"),
};
const Params = z.object({ applicationId: z.uuid() });

const applyRoute = createRoute({
  method: "post",
  path: "/applications",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  request: body(CreateApplicationInput),
  responses: { 201: json(ApplicationDto, "Candidature envoyée"), ...errors },
});
const mineRoute = createRoute({
  method: "get",
  path: "/me/application",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  responses: {
    200: json(MyApplicationDto, "Ma candidature de l'année, ou null"),
    ...errors,
  },
});
const withdrawRoute = createRoute({
  method: "delete",
  path: "/me/application",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  responses: { 204: { description: "Candidature retirée" }, ...errors },
});
const listRoute = createRoute({
  method: "get",
  path: "/applications",
  tags: ["applications"],
  middleware: [requirePermission("members:manage")] as const,
  request: { query: ListApplicationsQuery },
  responses: { 200: json(z.array(ApplicationDto), "Candidatures de l'année"), ...errors },
});
const decideRoute = createRoute({
  method: "post",
  path: "/applications/{applicationId}/decide",
  tags: ["applications"],
  middleware: [requirePermission("members:manage")] as const,
  request: { params: Params, ...body(DecideApplicationInput) },
  responses: { 200: json(ApplicationDto, "Statut changé"), ...errors },
});
const acceptRoute = createRoute({
  method: "post",
  path: "/applications/{applicationId}/accept",
  tags: ["applications"],
  middleware: [requirePermission("members:manage")] as const,
  request: { params: Params, ...body(AcceptApplicationInput) },
  responses: { 200: json(ApplicationDto, "Acceptée : adhésion créée"), ...errors },
});

export function createApplicationsRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(applyRoute, async (c) =>
      c.json(await apply(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(mineRoute, async (c) => c.json(await getMyApplication(authedCtx(c.get("ctx"))), 200))
    .openapi(withdrawRoute, async (c) => {
      await withdraw(authedCtx(c.get("ctx")));
      return c.body(null, 204);
    })
    .openapi(listRoute, async (c) =>
      c.json(await listApplications(authedCtx(c.get("ctx")), c.req.valid("query").status), 200),
    )
    .openapi(decideRoute, async (c) =>
      c.json(
        await decide(
          authedCtx(c.get("ctx")),
          c.req.valid("param").applicationId,
          c.req.valid("json").status,
        ),
        200,
      ),
    )
    .openapi(acceptRoute, async (c) =>
      c.json(
        await accept(
          authedCtx(c.get("ctx")),
          c.req.valid("param").applicationId,
          c.req.valid("json").poleId,
        ),
        200,
      ),
    );
}
