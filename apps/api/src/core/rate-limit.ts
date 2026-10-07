import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./context";
import { AppError } from "./errors";

/**
 * Fixed-window, in-memory rate limit per signed-in user (single API instance).
 * Requests without a session are left to the auth middlewares.
 */
export function rateLimitPerUser(options: { windowMs: number; max: number }) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return createMiddleware<AppEnv>(async (c, next) => {
    const userId = c.get("ctx").user?.id;
    if (userId) {
      const now = Date.now();
      const current = windows.get(userId);
      if (!current || current.resetAt <= now) {
        windows.set(userId, { count: 1, resetAt: now + options.windowMs });
      } else if (current.count >= options.max) {
        throw new AppError("RATE_LIMITED", 429, "Trop de requêtes. Patiente quelques secondes.");
      } else {
        current.count++;
      }
    }
    await next();
  });
}
