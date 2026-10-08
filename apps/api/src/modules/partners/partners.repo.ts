import { and, asc, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import { membership, partner, schoolYear, user } from "../../db/schema";

const selection = {
  partner,
  owner: { membershipId: membership.id, userId: user.id, name: user.name },
};

export type PartnerRow = NonNullable<Awaited<ReturnType<typeof findPartner>>>;

function baseQuery(db: DbOrTx) {
  return db
    .select(selection)
    .from(partner)
    .leftJoin(membership, eq(membership.id, partner.ownerMembershipId))
    .leftJoin(user, eq(user.id, membership.userId));
}

export function findPartners(db: DbOrTx) {
  return baseQuery(db).where(isNull(partner.deletedAt)).orderBy(asc(partner.name));
}

export function findActivePartners(db: DbOrTx) {
  return db
    .select({
      id: partner.id,
      name: partner.name,
      website: partner.website,
      benefits: partner.benefits,
    })
    .from(partner)
    .where(and(isNull(partner.deletedAt), eq(partner.status, "active")))
    .orderBy(asc(partner.name));
}

export async function findPartner(db: DbOrTx, partnerId: string) {
  const [row] = await baseQuery(db).where(
    and(eq(partner.id, partnerId), isNull(partner.deletedAt)),
  );
  return row;
}

export async function isCurrentMembership(db: DbOrTx, membershipId: string) {
  const [row] = await db
    .select({ id: membership.id })
    .from(membership)
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .where(
      and(
        eq(membership.id, membershipId),
        eq(schoolYear.isCurrent, true),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
      ),
    );
  return row !== undefined;
}

export async function insertPartner(db: DbOrTx, values: typeof partner.$inferInsert) {
  const [row] = await db.insert(partner).values(values).returning({ id: partner.id });
  if (!row) throw new Error("insertPartner: aucune ligne");
  return row.id;
}

export async function updatePartner(
  db: DbOrTx,
  partnerId: string,
  values: Patch<typeof partner.$inferInsert>,
) {
  const changes = compact(values);
  if (!changes) return;
  await db.update(partner).set(changes).where(eq(partner.id, partnerId));
}
