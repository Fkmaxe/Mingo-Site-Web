import {
  PushConfigDto,
  PushPreferencesInput,
  PushStatusDto,
  SubscribePushInput,
  UnsubscribePushInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, type z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import {
  getPushConfig,
  getPushStatus,
  setPushPreferences,
  subscribePush,
  unsubscribePush,
} from "./push.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } }, required: true },
});

const configRoute = createRoute({
  method: "get",
  path: "/push/config",
  tags: ["push"],
  middleware: [requireAuth] as const,
  responses: {
    200: json(PushConfigDto, "Clé publique VAPID (null si le push est désactivé)"),
    401: errorResponse("Pas de session"),
  },
});

const statusRoute = createRoute({
  method: "get",
  path: "/me/push",
  tags: ["push"],
  middleware: [requireAuth] as const,
  responses: {
    200: json(PushStatusDto, "Mes appareils abonnés et mes préférences"),
    401: errorResponse("Pas de session"),
  },
});

const subscribeRoute = createRoute({
  method: "post",
  path: "/me/push/subscriptions",
  tags: ["push"],
  middleware: [requireAuth] as const,
  request: body(SubscribePushInput),
  responses: {
    200: json(PushStatusDto, "Appareil abonné"),
    400: errorResponse("Abonnement invalide"),
    401: errorResponse("Pas de session"),
  },
});

const unsubscribeRoute = createRoute({
  method: "post",
  path: "/me/push/unsubscribe",
  tags: ["push"],
  middleware: [requireAuth] as const,
  request: body(UnsubscribePushInput),
  responses: {
    200: json(PushStatusDto, "Appareil désabonné"),
    400: errorResponse("Requête invalide"),
    401: errorResponse("Pas de session"),
  },
});

const preferencesRoute = createRoute({
  method: "patch",
  path: "/me/push",
  tags: ["push"],
  middleware: [requireAuth] as const,
  request: body(PushPreferencesInput),
  responses: {
    200: json(PushStatusDto, "Préférences enregistrées"),
    400: errorResponse("Requête invalide"),
    401: errorResponse("Pas de session"),
  },
});

export function createPushRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(configRoute, (c) => c.json(getPushConfig(authedCtx(c.get("ctx"))), 200))
    .openapi(statusRoute, async (c) => c.json(await getPushStatus(authedCtx(c.get("ctx"))), 200))
    .openapi(subscribeRoute, async (c) =>
      c.json(await subscribePush(authedCtx(c.get("ctx")), c.req.valid("json")), 200),
    )
    .openapi(unsubscribeRoute, async (c) =>
      c.json(await unsubscribePush(authedCtx(c.get("ctx")), c.req.valid("json").endpoint), 200),
    )
    .openapi(preferencesRoute, async (c) =>
      c.json(await setPushPreferences(authedCtx(c.get("ctx")), c.req.valid("json")), 200),
    );
}
