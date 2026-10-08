import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createMemoryMailer } from "../lib/mailer";
import { createMemoryPusher } from "../lib/push";
import { getTestDb } from "../test/db";
import type { AppEnv } from "./context";
import { onError } from "./errors";
import { NO_AUTHORIZATION } from "./permissions";
import { rateLimitPerUser } from "./rate-limit";

function appFor(userId: string | null) {
  const app = new Hono<AppEnv>();
  app.onError(onError);
  app.use("*", async (c, next) => {
    const user = userId ? { id: userId, email: "x@myskolae.fr", name: "X" } : null;
    c.set("ctx", {
      user,
      db: getTestDb(),
      services: {
        mailer: createMemoryMailer(),
        pusher: createMemoryPusher(),
        notifier: { notifyUsers: async () => 0, announceEvent: async () => 0 },
        webOrigin: "http://localhost:3000",
      },
      ...NO_AUTHORIZATION,
    });
    await next();
  });
  return app;
}

describe("rateLimitPerUser", () => {
  it("allows `max` requests per window and per user, then answers 429", async () => {
    vi.useFakeTimers();
    const limit = rateLimitPerUser({ windowMs: 1000, max: 2 });
    const alice = appFor("alice")
      .use("*", limit)
      .get("/", (c) => c.text("ok"));
    const bob = appFor("bob")
      .use("*", limit)
      .get("/", (c) => c.text("ok"));

    expect((await alice.request("/")).status).toBe(200);
    expect((await alice.request("/")).status).toBe(200);
    const limited = await alice.request("/");
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect((await bob.request("/")).status).toBe(200);

    vi.advanceTimersByTime(1001);
    expect((await alice.request("/")).status).toBe(200);
    vi.useRealTimers();
  });
});
