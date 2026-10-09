import { and, asc, desc, eq, ilike, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { auditLog, membership, pole, schoolYear, user } from "../../db/schema";

// --- School years ---

const yearSelection = {
  id: schoolYear.id,
  label: schoolYear.label,
  startsOn: schoolYear.startsOn,
  endsOn: schoolYear.endsOn,
  isCurrent: schoolYear.isCurrent,
};

export function findSchoolYears(db: DbOrTx) {
  return db.select(yearSelection).from(schoolYear).orderBy(desc(schoolYear.startsOn));
}

export async function findSchoolYear(db: DbOrTx, id: string) {
  const [row] = await db.select(yearSelection).from(schoolYear).where(eq(schoolYear.id, id));
  return row;
}

export async function schoolYearLabelExists(db: DbOrTx, label: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schoolYear.id })
    .from(schoolYear)
    .where(eq(schoolYear.label, label));
  return row !== undefined;
}

export async function hasCurrentSchoolYear(db: DbOrTx): Promise<boolean> {
  const [row] = await db
    .select({ id: schoolYear.id })
    .from(schoolYear)
    .where(eq(schoolYear.isCurrent, true));
  return row !== undefined;
}

export async function insertSchoolYear(db: DbOrTx, values: typeof schoolYear.$inferInsert) {
  const [row] = await db.insert(schoolYear).values(values).returning({ id: schoolYear.id });
  if (!row) throw new Error("insertSchoolYear: aucune ligne insérée");
  return row.id;
}

/** Only one current year (partial unique index): the old one is unset first. */
export async function makeCurrentSchoolYear(db: DbOrTx, id: string) {
  await db.update(schoolYear).set({ isCurrent: false }).where(eq(schoolYear.isCurrent, true));
  await db.update(schoolYear).set({ isCurrent: true }).where(eq(schoolYear.id, id));
}

// --- Poles ---

export async function poleSlugExists(db: DbOrTx, slug: string): Promise<boolean> {
  const [row] = await db.select({ id: pole.id }).from(pole).where(eq(pole.slug, slug));
  return row !== undefined;
}

export async function poleNameTaken(db: DbOrTx, name: string, exceptId?: string) {
  const [row] = await db
    .select({ id: pole.id })
    .from(pole)
    .where(
      and(
        sql`lower(${pole.name}) = lower(${name})`,
        exceptId ? sql`${pole.id} <> ${exceptId}` : undefined,
      ),
    );
  return row !== undefined;
}

export async function insertPole(db: DbOrTx, values: typeof pole.$inferInsert) {
  const [row] = await db.insert(pole).values(values).returning({ id: pole.id });
  if (!row) throw new Error("insertPole: aucune ligne insérée");
  return row.id;
}

export async function updatePole(
  db: DbOrTx,
  id: string,
  values: { name: string; description: string | null },
) {
  await db
    .update(pole)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(pole.id, id));
}

// --- Users and memberships ---

const userSelection = {
  id: user.id,
  name: user.name,
  email: user.email,
  promo: user.promo,
  isAdmin: user.isAdmin,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
};

/** Wildcards of the search are escaped. */
function contains(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export type UserScope = "all" | "roles" | "unverified";

function usersWhere(params: {
  q: string | undefined;
  scope: UserScope;
  schoolYearId: string | null;
}) {
  const search = params.q
    ? or(ilike(user.name, contains(params.q)), ilike(user.email, contains(params.q)))
    : undefined;
  let scope: SQL | undefined;
  if (params.scope === "roles") {
    const isMember = params.schoolYearId
      ? sql`exists (select 1 from ${membership} where ${membership.userId} = ${user.id}
          and ${membership.schoolYearId} = ${params.schoolYearId}
          and ${membership.isActive} and ${membership.deletedAt} is null)`
      : sql`false`;
    scope = or(eq(user.isAdmin, true), isMember);
  } else if (params.scope === "unverified") {
    scope = eq(user.emailVerified, false);
  }
  return and(search, scope);
}

/** Accounts of the scope (and search): newest first, or by name for role holders. 100 at most. */
export function findUsers(
  db: DbOrTx,
  params: { q: string | undefined; scope: UserScope; schoolYearId: string | null },
) {
  return db
    .select(userSelection)
    .from(user)
    .where(usersWhere(params))
    .orderBy(params.scope === "roles" ? asc(user.name) : desc(user.createdAt), asc(user.id))
    .limit(100);
}

export async function countUsers(
  db: DbOrTx,
  params: { q: string | undefined; scope: UserScope; schoolYearId: string | null },
): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(user).where(usersWhere(params));
  return Number(row?.n ?? 0);
}

export async function findUser(db: DbOrTx, id: string) {
  const [row] = await db.select(userSelection).from(user).where(eq(user.id, id));
  return row;
}

export async function findUserByEmail(db: DbOrTx, email: string) {
  const [row] = await db
    .select(userSelection)
    .from(user)
    .where(sql`lower(${user.email}) = lower(${email})`);
  return row;
}

export async function setUserAdmin(db: DbOrTx, id: string, isAdmin: boolean) {
  await db.update(user).set({ isAdmin, updatedAt: new Date() }).where(eq(user.id, id));
}

/** Active memberships of these users in a school year. */
export function findActiveMemberships(db: DbOrTx, userIds: string[], schoolYearId: string) {
  if (userIds.length === 0) return Promise.resolve([]);
  return db
    .select({
      id: membership.id,
      userId: membership.userId,
      role: membership.role,
      boardPosition: membership.boardPosition,
      pole: { id: pole.id, name: pole.name },
    })
    .from(membership)
    .leftJoin(pole, eq(pole.id, membership.poleId))
    .where(
      and(
        inArray(membership.userId, userIds),
        eq(membership.schoolYearId, schoolYearId),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
      ),
    )
    .orderBy(asc(membership.role));
}

/** The row for (user, pole or board, year), removed ones included (unique constraint). */
export async function findMembershipRow(
  db: DbOrTx,
  key: { userId: string; poleId: string | null; schoolYearId: string },
) {
  const [row] = await db
    .select({ id: membership.id })
    .from(membership)
    .where(
      and(
        eq(membership.userId, key.userId),
        key.poleId === null ? isNull(membership.poleId) : eq(membership.poleId, key.poleId),
        eq(membership.schoolYearId, key.schoolYearId),
      ),
    );
  return row;
}

export async function insertMembership(db: DbOrTx, values: typeof membership.$inferInsert) {
  const [row] = await db.insert(membership).values(values).returning({ id: membership.id });
  if (!row) throw new Error("insertMembership: aucune ligne insérée");
  return row.id;
}

/** Reactivates a removed membership, or changes the role of an active one. */
export async function reviveMembership(
  db: DbOrTx,
  id: string,
  values: {
    role: (typeof membership.$inferInsert)["role"];
    boardPosition: (typeof membership.$inferInsert)["boardPosition"];
  },
) {
  await db
    .update(membership)
    .set({ ...values, isActive: true, deletedAt: null, updatedAt: new Date() })
    .where(eq(membership.id, id));
}

export async function findMembership(db: DbOrTx, id: string) {
  const [row] = await db
    .select({
      id: membership.id,
      userId: membership.userId,
      poleId: membership.poleId,
      role: membership.role,
      deletedAt: membership.deletedAt,
    })
    .from(membership)
    .where(eq(membership.id, id));
  return row;
}

export async function removeMembership(db: DbOrTx, id: string, at: Date) {
  await db
    .update(membership)
    .set({ isActive: false, deletedAt: at, updatedAt: at })
    .where(eq(membership.id, id));
}

// --- Audit log ---

export function findAuditEntries(
  db: DbOrTx,
  params: { after: { createdAtKey: string; id: string } | null; limit: number },
) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      payload: auditLog.payload,
      createdAt: auditLog.createdAt,
      createdAtKey: sql<string>`${auditLog.createdAt}::text`,
      actor: { id: user.id, name: user.name },
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorUserId))
    .where(
      params.after
        ? sql`(${auditLog.createdAt}, ${auditLog.id}) < (${params.after.createdAtKey}::timestamptz, ${params.after.id}::uuid)`
        : undefined,
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(params.limit + 1);
}
