import { createMiddleware } from "hono/factory";
import type { DbOrTx } from "../db/client";
import type { Auth } from "./auth/auth";
import { AppError } from "./errors";

export type SessionUser = { id: string; email: string; name: string };

/** Passed to every service. Services never see Hono objects. */
export type Ctx = {
  user: SessionUser | null;
  db: DbOrTx;
};

export type AuthedCtx = Ctx & { user: SessionUser };

export type AppEnv = { Variables: { ctx: Ctx } };

export function loadContext(auth: Auth, db: DbOrTx) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const user = session
      ? { id: session.user.id, email: session.user.email, name: session.user.name }
      : null;
    c.set("ctx", { user, db });
    await next();
  });
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("ctx").user) {
    throw new AppError("UNAUTHENTICATED", 401, "Connecte-toi pour accéder à cette page.");
  }
  await next();
});

/** For handlers behind `requireAuth`. */
export function authedCtx(ctx: Ctx): AuthedCtx {
  if (!ctx.user) {
    throw new AppError("UNAUTHENTICATED", 401, "Connecte-toi pour accéder à cette page.");
  }
  return { ...ctx, user: ctx.user };
}
