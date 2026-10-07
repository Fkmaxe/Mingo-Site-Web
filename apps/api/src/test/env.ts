import { type AppDeps, createApp } from "../app";
import { createMemoryMailer } from "../lib/mailer";
import { getTestDb } from "./db";

export const testEnv: AppDeps["env"] = {
  NODE_ENV: "test",
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
  BETTER_AUTH_URL: "http://localhost:3000",
};

export function createTestApp(overrides: Partial<AppDeps> = {}) {
  const mailer = createMemoryMailer();
  const app = createApp({ env: testEnv, db: getTestDb(), mailer, ...overrides });
  return Object.assign(app, { mailer });
}
