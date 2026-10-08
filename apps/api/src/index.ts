import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDb } from "./db/client";
import { loadEnv } from "./env";
import { startScheduler } from "./jobs/scheduler";
import { createSmtpMailer } from "./lib/mailer";
import { createDisabledPusher, createWebPusher } from "./lib/push";
import { createNotifier } from "./modules/push";

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const mailer = createSmtpMailer(env);
const pusher =
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
    ? createWebPusher({
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT,
      })
    : createDisabledPusher();
if (!pusher.enabled) console.log("Notifications push désactivées (pas de clés VAPID).");
const app = createApp({ env, db, mailer, pusher });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API BDE Mingo sur http://localhost:${info.port}`);
});

const stopScheduler = startScheduler({
  db,
  services: { mailer, pusher, notifier: createNotifier(db, pusher), webOrigin: env.WEB_ORIGIN },
});

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
