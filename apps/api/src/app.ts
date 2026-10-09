import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { AUTH_BASE_PATH, type AuthDeps, createAuth } from "./core/auth/auth";
import { type AppEnv, loadContext } from "./core/context";
import { errorBody, onError, onNotFound, throwOnValidationError } from "./core/errors";
import type { Pusher } from "./lib/push";
import { createAdminRouter } from "./modules/admin";
import { createApplicationsRouter } from "./modules/applications";
import { createCheckinRouter } from "./modules/checkin";
import { createEventsRouter } from "./modules/events";
import { createExportsRouter } from "./modules/exports";
import { createGradesRouter } from "./modules/grades";
import { createHealthRouter } from "./modules/health";
import { createMeRouter } from "./modules/me";
import { createMeetingsRouter } from "./modules/meetings";
import { createMembersRouter } from "./modules/members";
import { createOpenPointsRouter } from "./modules/open-points";
import { createPartnersRouter } from "./modules/partners";
import { createPolesRouter } from "./modules/poles";
import { createNotifier, createPushRouter } from "./modules/push";
import { createRegistrationsRouter, createTeamsRouter } from "./modules/registrations";
import { createStaffRouter } from "./modules/staff";
import { createStatsRouter } from "./modules/stats";
import { createTasksRouter } from "./modules/tasks";
import { createTreasuryRouter } from "./modules/treasury";

export type AppDeps = AuthDeps & { pusher: Pusher };

export const OPENAPI_CONFIG = {
  openapi: "3.1.0",
  info: { title: "API BDE Mingo", version: "1.0.0" },
};

export function createApp(deps: AppDeps) {
  const { env, db } = deps;
  const auth = createAuth(deps);
  const app = new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError });

  app.use("*", secureHeaders());
  app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
  // JSON only (files are links): anything bigger is a mistake or an attack.
  app.use(
    "*",
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: (c) =>
        c.json(errorBody("VALIDATION_ERROR", "La requête est trop volumineuse."), 413),
    }),
  );
  app.onError(onError);
  app.notFound(onNotFound);

  app.route("/", createHealthRouter(db));
  app.on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, (c) => auth.handler(c.req.raw));

  app.use(
    "/v1/*",
    loadContext(auth, db, {
      mailer: deps.mailer,
      pusher: deps.pusher,
      notifier: createNotifier(db, deps.pusher),
      webOrigin: env.WEB_ORIGIN,
    }),
  );
  app.route("/v1", createMeRouter());
  app.route("/v1", createPolesRouter());
  app.route("/v1", createEventsRouter());
  app.route("/v1", createRegistrationsRouter());
  app.route("/v1", createTeamsRouter());
  app.route("/v1", createCheckinRouter());
  app.route("/v1", createOpenPointsRouter());
  app.route("/v1", createExportsRouter());
  app.route("/v1", createStaffRouter());
  app.route("/v1", createGradesRouter());
  app.route("/v1", createTasksRouter());
  app.route("/v1", createMeetingsRouter());
  app.route("/v1", createApplicationsRouter());
  app.route("/v1", createMembersRouter());
  app.route("/v1", createPartnersRouter());
  app.route("/v1", createTreasuryRouter());
  app.route("/v1", createStatsRouter());
  app.route("/v1", createPushRouter());
  app.route("/v1", createAdminRouter());

  app.doc31("/v1/openapi.json", OPENAPI_CONFIG);
  if (env.NODE_ENV !== "production") {
    app.get("/v1/docs", Scalar({ url: "/v1/openapi.json", pageTitle: "API BDE Mingo" }));
  }

  return app;
}

export type App = ReturnType<typeof createApp>;
