import type { AppRole } from "@bde/shared";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { membership, rolePermission, schoolYear, user } from "../../db/schema";

export async function findAuthorizationData(db: DbOrTx, userId: string) {
  const [[row], memberships] = await Promise.all([
    db.select({ isAdmin: user.isAdmin }).from(user).where(eq(user.id, userId)),
    db
      .select({
        poleId: membership.poleId,
        role: membership.role,
        boardPosition: membership.boardPosition,
      })
      .from(membership)
      .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
      .where(
        and(
          eq(membership.userId, userId),
          eq(schoolYear.isCurrent, true),
          eq(membership.isActive, true),
          isNull(membership.deletedAt),
        ),
      ),
  ]);
  return row ? { isAdmin: row.isAdmin, memberships } : undefined;
}

export async function findPermissionsOfRoles(db: DbOrTx, roles: AppRole[]) {
  const rows = await db
    .selectDistinct({ permission: rolePermission.permission })
    .from(rolePermission)
    .where(inArray(rolePermission.role, roles));
  return rows.map((r) => r.permission);
}
