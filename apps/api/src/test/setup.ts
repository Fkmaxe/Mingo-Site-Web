import { afterAll, beforeEach } from "vitest";
import { closeTestDb, resetDb } from "./db";
import { testMailer } from "./env";

beforeEach(async () => {
  await resetDb();
  testMailer.sent.length = 0;
});

afterAll(async () => {
  await closeTestDb();
});
