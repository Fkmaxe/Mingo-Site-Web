import { MeDto } from "@bde/shared";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { getMe } from "./me.service";

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["me"],
  middleware: [requireAuth] as const,
  responses: {
    200: {
      content: { "application/json": { schema: MeDto } },
      description: "Utilisateur connecté, ses rôles de l'année en cours",
    },
    401: errorResponse("Pas de session"),
  },
});

export function createMeRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError }).openapi(
    getMeRoute,
    async (c) => c.json(await getMe(authedCtx(c.get("ctx"))), 200),
  );
}
