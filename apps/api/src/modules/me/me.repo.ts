import { and, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { membership, pole, schoolYear, user } from "../../db/schema";

export async function findUserById(db: DbOrTx, userId: string) {
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      promo: user.promo,
      image: user.image,
      isAdmin: user.isAdmin,
    })
    .from(user)
    .where(eq(user.id, userId));
  return row;
}

/** Active, non-deleted memberships of the current school year. */
export async function findCurrentMemberships(db: DbOrTx, userId: string) {
  return db
    .select({
      id: membership.id,
      role: membership.role,
      boardPosition: membership.boardPosition,
      poleId: pole.id,
      poleSlug: pole.slug,
      poleName: pole.name,
    })
    .from(membership)
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .leftJoin(pole, eq(pole.id, membership.poleId))
    .where(
      and(
        eq(membership.userId, userId),
        eq(schoolYear.isCurrent, true),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
      ),
    );
}
