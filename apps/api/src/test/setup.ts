import { afterAll, beforeEach } from "vitest";
import { closeTestDb, resetDb } from "./db";
import { testMailer, testPusher } from "./env";

beforeEach(async () => {
  await resetDb();
  testMailer.sent.length = 0;
  testPusher.sent.length = 0;
  testPusher.gone.clear();
});

afterAll(async () => {
  await closeTestDb();
});
