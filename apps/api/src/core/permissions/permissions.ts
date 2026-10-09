import { isPermission, PERMISSIONS, type Permission } from "@bde/shared";
import { createMiddleware } from "hono/factory";
import type { DbOrTx } from "../../db/client";
import type { AppEnv, Ctx } from "../context";
import { AppError } from "../errors";
import { findAuthorizationData, findPermissionsOfRoles } from "./permissions.repo";
import { type ActiveMembership, resolveRoles } from "./roles";

export type Authorization = {
  roles: ReturnType<typeof resolveRoles>;
  permissions: Set<Permission>;
  memberships: ActiveMembership[];
};

export const NO_AUTHORIZATION: Authorization = {
  roles: [],
  permissions: new Set(),
  memberships: [],
};

export async function loadAuthorization(db: DbOrTx, userId: string): Promise<Authorization> {
  const data = await findAuthorizationData(db, userId);
  if (!data) return NO_AUTHORIZATION;
  const roles = resolveRoles(data, data.memberships);
  // The site administrator has every permission, whatever the role_permission table says.
  const permissions = roles.includes("admin")
    ? new Set<Permission>(PERMISSIONS)
    : new Set((await findPermissionsOfRoles(db, roles)).filter(isPermission));
  return { roles, permissions, memberships: data.memberships };
}

function forbidden() {
  return new AppError("FORBIDDEN", 403, "Tu n'as pas les droits pour faire ça.");
}

/** Route middleware: 401 without a session, 403 without the permission. */
export function requirePermission(permission: Permission) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const ctx = c.get("ctx");
    if (!ctx.user) {
      throw new AppError("UNAUTHENTICATED", 401, "Connecte-toi pour accéder à cette page.");
    }
    if (!ctx.permissions.has(permission)) throw forbidden();
    await next();
  });
}

/**
 * For pole-scoped actions, in services: allowed with `poles:all` (board), otherwise only
 * for a pole lead of that pole in the current school year.
 */
export function assertPoleAccess(
  ctx: Pick<Ctx, "permissions" | "memberships">,
  poleId: string,
): void {
  if (ctx.permissions.has("poles:all")) return;
  const leadsPole = ctx.memberships.some((m) => m.role === "pole_lead" && m.poleId === poleId);
  if (!leadsPole) throw forbidden();
}
