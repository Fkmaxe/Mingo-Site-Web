import { type AppDeps, createApp } from "../app";
import { createMemoryMailer, type MemoryMailer } from "../lib/mailer";
import { createMemoryPusher, type MemoryPusher } from "../lib/push";
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

export function createTestApp(
  overrides: Partial<Omit<AppDeps, "mailer" | "pusher">> & {
    mailer?: MemoryMailer;
    pusher?: MemoryPusher;
  } = {},
) {
  const mailer = overrides.mailer ?? testMailer;
  const pusher = overrides.pusher ?? testPusher;
  const app = createApp({ env: testEnv, db: getTestDb(), ...overrides, mailer, pusher });
  return Object.assign(app, { mailer });
}
