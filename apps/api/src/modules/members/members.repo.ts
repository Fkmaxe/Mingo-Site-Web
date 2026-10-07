import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { membership, pole, schoolYear, user } from "../../db/schema";

/** Active memberships of the current school year: board first, then by pole and name. */
export function findDirectory(db: DbOrTx) {
  return db
    .select({
      membershipId: membership.id,
      role: membership.role,
      boardPosition: membership.boardPosition,
      poleId: pole.id,
      poleName: pole.name,
      user: { id: user.id, name: user.name, email: user.email, promo: user.promo },
    })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .leftJoin(pole, eq(pole.id, membership.poleId))
    .where(
      and(
        eq(schoolYear.isCurrent, true),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
      ),
    )
    .orderBy(sql`${pole.name} asc nulls first`, asc(user.name));
}
