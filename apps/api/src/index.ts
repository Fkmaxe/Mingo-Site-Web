import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDb } from "./db/client";
import { loadEnv } from "./env";
import { startScheduler } from "./jobs/scheduler";
import { createSmtpMailer } from "./lib/mailer";

const env = loadEnv();
const { db } = createDb(env.DATABASE_URL);
const mailer = createSmtpMailer(env);
const app = createApp({ env, db, mailer });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API BDE Mingo sur http://localhost:${info.port}`);
});

startScheduler({ db, services: { mailer, webOrigin: env.WEB_ORIGIN } });
