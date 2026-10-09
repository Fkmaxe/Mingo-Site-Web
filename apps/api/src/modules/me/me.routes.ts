import { MeDto, UpdateProfileInput } from "@bde/shared";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { getMe, updateProfile } from "./me.service";

const meResponse = (description: string) => ({
  content: { "application/json": { schema: MeDto } },
  description,
});

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["me"],
  middleware: [requireAuth] as const,
  responses: {
    200: meResponse("Utilisateur connecté, ses rôles de l'année en cours"),
    401: errorResponse("Pas de session"),
  },
});

// Anyone signed in, on their own account only.
const updateMeRoute = createRoute({
  method: "patch",
  path: "/me",
  tags: ["me"],
  middleware: [requireAuth] as const,
  request: { body: { content: { "application/json": { schema: UpdateProfileInput } } } },
  responses: {
    200: meResponse("Profil modifié"),
    400: errorResponse("Données invalides"),
    401: errorResponse("Pas de session"),
  },
});

export function createMeRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(getMeRoute, async (c) => c.json(await getMe(authedCtx(c.get("ctx"))), 200))
    .openapi(updateMeRoute, async (c) =>
      c.json(await updateProfile(authedCtx(c.get("ctx")), c.req.valid("json")), 200),
    );
}
