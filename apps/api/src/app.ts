import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { AUTH_BASE_PATH, type AuthDeps, createAuth } from "./core/auth/auth";
import { type AppEnv, loadContext } from "./core/context";
import { onError, onNotFound, throwOnValidationError } from "./core/errors";
import { createHealthRouter } from "./modules/health";
import { createMeRouter } from "./modules/me";

export type AppDeps = AuthDeps;

export const OPENAPI_CONFIG = {
  openapi: "3.1.0",
  info: { title: "API BDE Mingo", version: "1.0.0" },
};

export function createApp(deps: AppDeps) {
  const { env, db } = deps;
  const auth = createAuth(deps);
  const app = new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError });

  app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.onError(onError);
  app.notFound(onNotFound);

  app.route("/", createHealthRouter(db));
  app.on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, (c) => auth.handler(c.req.raw));

  app.use("/v1/*", loadContext(auth, db));
  app.route("/v1", createMeRouter());

  app.doc31("/v1/openapi.json", OPENAPI_CONFIG);
  if (env.NODE_ENV !== "production") {
    app.get("/v1/docs", Scalar({ url: "/v1/openapi.json", pageTitle: "API BDE Mingo" }));
  }

  return app;
}

export type App = ReturnType<typeof createApp>;
