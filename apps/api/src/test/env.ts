import type { AppDeps } from "../app";
import { createApp } from "../app";
import { getTestDb } from "./db";

export const testEnv: AppDeps["env"] = {
  NODE_ENV: "test",
  WEB_ORIGIN: "http://localhost:3000",
};

export function createTestApp(overrides: Partial<AppDeps> = {}) {
  return createApp({ env: testEnv, db: getTestDb(), ...overrides });
}
