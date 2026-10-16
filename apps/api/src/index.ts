import { join } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDb } from "./db/client";
import { loadEnv } from "./env";
import { startScheduler } from "./jobs/scheduler";
import { createDisabledDiscord, createRestDiscord } from "./lib/discord";
import { createSmtpMailer } from "./lib/mailer";
import { createDisabledPusher, createWebPusher } from "./lib/push";
import {
  createDiskDocumentStore,
  createDiskPhotoStore,
  createDiskReceiptStore,
} from "./lib/storage";
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
const photos = createDiskPhotoStore(env.UPLOAD_DIR);
const receipts = createDiskReceiptStore(join(env.UPLOAD_DIR, "receipts"));
const taskFiles = createDiskDocumentStore(join(env.UPLOAD_DIR, "task-files"));
const applicationFiles = createDiskDocumentStore(join(env.UPLOAD_DIR, "application-files"));
const discord = env.DISCORD_BOT_TOKEN
  ? createRestDiscord(env.DISCORD_BOT_TOKEN, {
      events: env.DISCORD_EVENTS_CHANNEL_ID
        ? { channelId: env.DISCORD_EVENTS_CHANNEL_ID, roleId: env.DISCORD_EVENTS_ROLE_ID }
        : undefined,
      applications: env.DISCORD_APPLICATIONS_CHANNEL_ID,
      boardTasks: env.DISCORD_BOARD_TASKS_CHANNEL_ID,
      poleTasks: env.DISCORD_TASKS_CHANNELS,
    })
  : createDisabledDiscord();
if (!discord.enabled) console.log("Bot Discord désactivé (pas de DISCORD_BOT_TOKEN).");
const app = createApp({
  env,
  db,
  mailer,
  pusher,
  photos,
  receipts,
  taskFiles,
  applicationFiles,
  discord,
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API BDE Mingo sur http://localhost:${info.port}`);
});

const stopScheduler = startScheduler({
  db,
  services: {
    mailer,
    pusher,
    notifier: createNotifier(db, pusher),
    discord,
    webOrigin: env.WEB_ORIGIN,
  },
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
