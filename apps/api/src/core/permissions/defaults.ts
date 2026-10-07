import { APP_ROLES, DEFAULT_ROLE_PERMISSIONS } from "@bde/shared";
import { count } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { rolePermission } from "../../db/schema";

export const DEFAULT_ROLE_PERMISSION_ROWS = APP_ROLES.flatMap((role) =>
  DEFAULT_ROLE_PERMISSIONS[role].map((permission) => ({ role, permission })),
);

/**
 * Inserts the default mapping on first install only (empty table), so permissions removed
 * by an admin are not restored. New permissions are added later through SQL migrations.
 */
export async function ensureDefaultRolePermissions(db: DbOrTx): Promise<void> {
  const [row] = await db.select({ n: count() }).from(rolePermission);
  if ((row?.n ?? 0) > 0) return;
  await db.insert(rolePermission).values(DEFAULT_ROLE_PERMISSION_ROWS);
}
