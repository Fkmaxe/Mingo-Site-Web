import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDb } from "./db/client";
import { loadEnv } from "./env";
import { startScheduler } from "./jobs/scheduler";
import { createSmtpMailer } from "./lib/mailer";

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const mailer = createSmtpMailer(env);
const app = createApp({ env, db, mailer });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API BDE Mingo sur http://localhost:${info.port}`);
});

const stopScheduler = startScheduler({ db, services: { mailer, webOrigin: env.WEB_ORIGIN } });

// docker stop: finish the requests in progress, then close the pool (forced after 10 s).
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    console.log(`${signal} reçu : arrêt de l'API`);
    stopScheduler();
    setTimeout(() => process.exit(1), 10_000).unref();
    server.close(() => {
      void close().finally(() => process.exit(0));
    });
  });
}
