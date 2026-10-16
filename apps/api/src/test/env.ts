import { type AppDeps, createApp } from "../app";
import type { Services } from "../core/context";
import { createMemoryDiscord } from "../lib/discord";
import { createMemoryMailer, type MemoryMailer } from "../lib/mailer";
import { createMemoryPusher, type MemoryPusher } from "../lib/push";
import {
  createMemoryDocumentStore,
  createMemoryPhotoStore,
  createMemoryReceiptStore,
} from "../lib/storage";
import { createNotifier } from "../modules/push";
import { getTestDb } from "./db";

export const testEnv: AppDeps["env"] = {
  NODE_ENV: "test",
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
  BETTER_AUTH_URL: "http://localhost:3000",
};

/** Shared by every test app of a test file; emptied before each test (setup.ts). */
export const testMailer = createMemoryMailer();
export const testPusher = createMemoryPusher();
/** Notifications of the test apps and jobs, through the memory pusher. */
export const testNotifier = createNotifier(getTestDb(), testPusher);
export const testPhotos = createMemoryPhotoStore();
export const testReceipts = createMemoryReceiptStore();
export const testTaskFiles = createMemoryDocumentStore();
export const testApplicationFiles = createMemoryDocumentStore();
/** Discord with every channel set: the pole of slug `sport` has its own. */
export const testDiscord = createMemoryDiscord({
  events: { channelId: "100000000000000001", roleId: "900000000000000001" },
  applications: "100000000000000002",
  boardTasks: "100000000000000003",
  poleTasks: { sport: "100000000000000004" },
});

/** The services of the test apps, for jobs and services called directly. */
export const testServices = (): Services => ({
  mailer: testMailer,
  pusher: testPusher,
  notifier: testNotifier,
  discord: testDiscord,
  webOrigin: "http://localhost:3000",
});

export function createTestApp(
  overrides: Partial<Omit<AppDeps, "mailer" | "pusher">> & {
    mailer?: MemoryMailer;
    pusher?: MemoryPusher;
  } = {},
) {
  const mailer = overrides.mailer ?? testMailer;
  const pusher = overrides.pusher ?? testPusher;
  const app = createApp({
    env: testEnv,
    db: getTestDb(),
    photos: testPhotos,
    receipts: testReceipts,
    taskFiles: testTaskFiles,
    applicationFiles: testApplicationFiles,
    discord: testDiscord,
    ...overrides,
    mailer,
    pusher,
  });
  return Object.assign(app, { mailer });
}
