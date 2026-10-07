import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { onError, onNotFound, throwOnValidationError } from "./core/errors";
import type { Db } from "./db/client";
import type { Env } from "./env";
import { createHealthRouter } from "./modules/health";

export type AppDeps = {
  env: Pick<Env, "NODE_ENV" | "WEB_ORIGIN">;
  db: Db;
};

export function createApp(deps: AppDeps) {
  const { env, db } = deps;
  const app = new OpenAPIHono({ defaultHook: throwOnValidationError });

  app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.onError(onError);
  app.notFound(onNotFound);

  app.route("/", createHealthRouter(db));

  app.doc31("/v1/openapi.json", {
    openapi: "3.1.0",
    info: { title: "API BDE Mingo", version: "1.0.0" },
  });
  if (env.NODE_ENV !== "production") {
    app.get("/v1/docs", Scalar({ url: "/v1/openapi.json", pageTitle: "API BDE Mingo" }));
  }

  return app;
}

export type App = ReturnType<typeof createApp>;
