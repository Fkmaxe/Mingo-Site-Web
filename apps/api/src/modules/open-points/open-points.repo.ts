import type { OpenPointsStatus } from "@bde/shared";
import { and, asc, desc, eq, ilike, inArray, isNull, or, type SQL, sql, sum } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { attendance, event, membership, openPointsLedger, user } from "../../db/schema";

export async function insertMovement(db: DbOrTx, values: typeof openPointsLedger.$inferInsert) {
  // A check-in produces at most one movement (unique attendance_id).
  const [row] = await db
    .insert(openPointsLedger)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: openPointsLedger.id });
  return row?.id;
}

/** Users among `userIds` with an active membership in the school year: BDE members. */
export async function findActiveMemberIds(db: DbOrTx, userIds: string[], schoolYearId: string) {
  if (userIds.length === 0) return new Set<string>();
  const rows = await db
    .selectDistinct({ userId: membership.userId })
    .from(membership)
    .where(
      and(
        inArray(membership.userId, userIds),
        eq(membership.schoolYearId, schoolYearId),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
      ),
    );
  return new Set(rows.map((r) => r.userId));
}

/** Balance (validated + exported) and pending total per user for a school year. */
export async function findTotals(db: DbOrTx, userIds: string[], schoolYearId: string) {
  if (userIds.length === 0) return new Map<string, { balance: number; pending: number }>();
  const rows = await db
    .select({
      userId: openPointsLedger.userId,
      balance: sum(
        sql`case when ${openPointsLedger.status} in ('validated', 'exported') then ${openPointsLedger.delta} else 0 end`,
      ).mapWith(Number),
      pending: sum(
        sql`case when ${openPointsLedger.status} = 'pending' then ${openPointsLedger.delta} else 0 end`,
      ).mapWith(Number),
    })
    .from(openPointsLedger)
    .where(
      and(
        inArray(openPointsLedger.userId, userIds),
        eq(openPointsLedger.schoolYearId, schoolYearId),
      ),
    )
    .groupBy(openPointsLedger.userId);
  return new Map(rows.map((r) => [r.userId, { balance: r.balance, pending: r.pending }]));
}

const movementSelection = {
  id: openPointsLedger.id,
  delta: openPointsLedger.delta,
  reason: openPointsLedger.reason,
  source: openPointsLedger.source,
  status: openPointsLedger.status,
  createdAt: openPointsLedger.createdAt,
  decidedAt: openPointsLedger.decidedAt,
  eventId: event.id,
  eventSlug: event.slug,
  eventTitle: event.title,
};

export type MovementRow = Awaited<ReturnType<typeof findUserMovements>>[number];

export function findUserMovements(db: DbOrTx, userId: string, schoolYearId: string) {
  return db
    .select(movementSelection)
    .from(openPointsLedger)
    .leftJoin(attendance, eq(attendance.id, openPointsLedger.attendanceId))
    .leftJoin(event, eq(event.id, attendance.eventId))
    .where(
      and(eq(openPointsLedger.userId, userId), eq(openPointsLedger.schoolYearId, schoolYearId)),
    )
    .orderBy(desc(openPointsLedger.createdAt), desc(openPointsLedger.id))
    .limit(200);
}

export function findLedgerEntries(
  db: DbOrTx,
  params: {
    schoolYearId: string;
    status: OpenPointsStatus;
    eventId: string | undefined;
    /** `createdAtKey`: exact Postgres timestamp text, as returned by this query. */
    after: { createdAtKey: string; id: string } | null;
    limit: number;
  },
) {
  const conditions: (SQL | undefined)[] = [
    eq(openPointsLedger.schoolYearId, params.schoolYearId),
    eq(openPointsLedger.status, params.status),
    params.eventId ? eq(attendance.eventId, params.eventId) : undefined,
    params.after
      ? sql`(${openPointsLedger.createdAt}, ${openPointsLedger.id}) > (${params.after.createdAtKey}::timestamptz, ${params.after.id}::uuid)`
      : undefined,
  ];
  return db
    .select({
      ...movementSelection,
      createdAtKey: sql<string>`${openPointsLedger.createdAt}::text`,
      user: { id: user.id, name: user.name, email: user.email, promo: user.promo },
    })
    .from(openPointsLedger)
    .innerJoin(user, eq(user.id, openPointsLedger.userId))
    .leftJoin(attendance, eq(attendance.id, openPointsLedger.attendanceId))
    .leftJoin(event, eq(event.id, attendance.eventId))
    .where(and(...conditions))
    .orderBy(asc(openPointsLedger.createdAt), asc(openPointsLedger.id))
    .limit(params.limit + 1);
}

/** Moves pending movements to `status`. Returns the ids actually changed. */
export async function decideMovements(
  db: DbOrTx,
  ids: string[],
  decision: { status: "validated" | "rejected"; decidedBy: string; decidedAt: Date },
) {
  const rows = await db
    .update(openPointsLedger)
    .set(decision)
    .where(and(inArray(openPointsLedger.id, ids), eq(openPointsLedger.status, "pending")))
    .returning({ id: openPointsLedger.id });
  return rows.map((r) => r.id);
}

export async function findUserById(db: DbOrTx, userId: string) {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email, promo: user.promo })
    .from(user)
    .where(eq(user.id, userId));
  return row;
}

export function searchUsers(db: DbOrTx, query: string) {
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select({ id: user.id, name: user.name, email: user.email, promo: user.promo })
    .from(user)
    .where(or(ilike(user.name, pattern), ilike(user.email, pattern)))
    .orderBy(asc(user.name))
    .limit(20);
}
