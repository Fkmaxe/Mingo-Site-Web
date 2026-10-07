import { type AppDeps, createApp } from "../app";
import { createMemoryMailer, type MemoryMailer } from "../lib/mailer";
import { getTestDb } from "./db";

export const testEnv: AppDeps["env"] = {
  NODE_ENV: "test",
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
  BETTER_AUTH_URL: "http://localhost:3000",
};

/** Shared by every test app of a test file; emptied before each test (setup.ts). */
export const testMailer = createMemoryMailer();

export function createTestApp(
  overrides: Partial<Omit<AppDeps, "mailer">> & { mailer?: MemoryMailer } = {},
) {
  const mailer = overrides.mailer ?? testMailer;
  const app = createApp({ env: testEnv, db: getTestDb(), ...overrides, mailer });
  return Object.assign(app, { mailer });
}
