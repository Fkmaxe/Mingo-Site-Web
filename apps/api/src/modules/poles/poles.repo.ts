import { and, asc, eq, isNull, ne } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { membership, pole, schoolYear, user } from "../../db/schema";

const columns = { id: pole.id, slug: pole.slug, name: pole.name, description: pole.description };

export function findAllPoles(db: DbOrTx) {
  return db.select(columns).from(pole).orderBy(asc(pole.name));
}

export async function findPoleById(db: DbOrTx, poleId: string) {
  const [row] = await db.select(columns).from(pole).where(eq(pole.id, poleId));
  return row;
}

/** Active members and leads of a pole for the current school year. */
export function findPoleMembers(db: DbOrTx, poleId: string) {
  return db
    .select({
      membershipId: membership.id,
      role: membership.role,
      user: { id: user.id, name: user.name, promo: user.promo },
    })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .where(
      and(
        eq(membership.poleId, poleId),
        eq(schoolYear.isCurrent, true),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
        ne(membership.role, "board"),
      ),
    )
    .orderBy(asc(user.name));
}
