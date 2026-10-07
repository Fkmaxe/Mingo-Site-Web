import type { GradeStatus } from "@bde/shared";
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import {
  attendance,
  event,
  gradePeriod,
  memberGrade,
  membership,
  pole,
  schoolYear,
  user,
} from "../../db/schema";

export type GradePeriodRow = typeof gradePeriod.$inferSelect;

export function findPeriods(db: DbOrTx, schoolYearId: string) {
  return db
    .select()
    .from(gradePeriod)
    .where(eq(gradePeriod.schoolYearId, schoolYearId))
    .orderBy(asc(gradePeriod.startsOn));
}

export async function findPeriod(db: DbOrTx, periodId: string) {
  const [row] = await db.select().from(gradePeriod).where(eq(gradePeriod.id, periodId));
  return row;
}

export async function insertPeriods(db: DbOrTx, values: (typeof gradePeriod.$inferInsert)[]) {
  return db.insert(gradePeriod).values(values).returning();
}

export async function updatePeriod(
  db: DbOrTx,
  periodId: string,
  values: Patch<typeof gradePeriod.$inferInsert>,
) {
  await db.update(gradePeriod).set(compact(values)).where(eq(gradePeriod.id, periodId));
}

export async function deletePeriod(db: DbOrTx, periodId: string) {
  await db.delete(gradePeriod).where(eq(gradePeriod.id, periodId));
}

export async function findSchoolYear(db: DbOrTx, schoolYearId: string) {
  const [row] = await db.select().from(schoolYear).where(eq(schoolYear.id, schoolYearId));
  return row;
}

/** Graded memberships of a school year: members and pole leads of a pole, active. */
export function findGradedMemberships(db: DbOrTx, schoolYearId: string, poleIds: "all" | string[]) {
  if (poleIds !== "all" && poleIds.length === 0) return Promise.resolve([]);
  return db
    .select({
      membershipId: membership.id,
      user: { id: user.id, name: user.name, promo: user.promo },
      pole: { id: pole.id, name: pole.name },
    })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .innerJoin(pole, eq(pole.id, membership.poleId))
    .where(
      and(
        eq(membership.schoolYearId, schoolYearId),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
        isNotNull(membership.poleId),
        ne(membership.role, "board"),
        poleIds === "all" ? undefined : inArray(membership.poleId, poleIds),
      ),
    )
    .orderBy(asc(pole.name), asc(user.name));
}

export async function findMembership(db: DbOrTx, membershipId: string) {
  const [row] = await db
    .select({
      id: membership.id,
      userId: membership.userId,
      poleId: membership.poleId,
      schoolYearId: membership.schoolYearId,
      role: membership.role,
    })
    .from(membership)
    .where(and(eq(membership.id, membershipId), isNull(membership.deletedAt)));
  return row;
}

/**
 * One presence per user and event (participant, staff or meeting), for events of the period
 * that were not cancelled. Points: the event's override, otherwise the period's default.
 */
export function findPresences(db: DbOrTx, period: GradePeriodRow, userIds: string[]) {
  if (userIds.length === 0) return Promise.resolve([]);
  const parisDay = sql`(${event.startsAt} at time zone 'Europe/Paris')::date`;
  return db
    .selectDistinctOn([attendance.userId, event.id], {
      userId: attendance.userId,
      eventId: event.id,
      title: event.title,
      startsAt: event.startsAt,
      points: sql<number>`coalesce(${event.memberPoints}, ${period.pointsPerPresence})`.mapWith(
        Number,
      ),
    })
    .from(attendance)
    .innerJoin(event, eq(event.id, attendance.eventId))
    .where(
      and(
        inArray(attendance.userId, userIds),
        ne(event.status, "cancelled"),
        isNull(event.deletedAt),
        sql`${parisDay} between ${period.startsOn} and ${period.endsOn}`,
      ),
    )
    .orderBy(attendance.userId, event.id);
}

export type GradeRow = typeof memberGrade.$inferSelect;

export function findGrades(db: DbOrTx, periodId: string, membershipIds: string[]) {
  if (membershipIds.length === 0) return Promise.resolve([] as GradeRow[]);
  return db
    .select()
    .from(memberGrade)
    .where(
      and(
        eq(memberGrade.gradePeriodId, periodId),
        inArray(memberGrade.membershipId, membershipIds),
      ),
    );
}

export function findGradesByIds(db: DbOrTx, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([] as GradeRow[]);
  return db.select().from(memberGrade).where(inArray(memberGrade.id, ids));
}

export async function countGradesWithStatus(db: DbOrTx, periodId: string, statuses: GradeStatus[]) {
  const rows = await db
    .select({ id: memberGrade.id })
    .from(memberGrade)
    .where(and(eq(memberGrade.gradePeriodId, periodId), inArray(memberGrade.status, statuses)));
  return rows.length;
}

export async function upsertGrade(
  db: DbOrTx,
  values: typeof memberGrade.$inferInsert,
): Promise<GradeRow> {
  const [row] = await db
    .insert(memberGrade)
    .values(values)
    .onConflictDoUpdate({
      target: [memberGrade.membershipId, memberGrade.gradePeriodId],
      set: {
        involvementPoints: values.involvementPoints,
        comment: values.comment,
        finalScore: values.finalScore,
        proposedBy: values.proposedBy,
      },
    })
    .returning();
  if (!row) throw new Error("upsertGrade: aucune ligne");
  return row;
}

export async function updateGrade(
  db: DbOrTx,
  gradeId: string,
  values: Patch<typeof memberGrade.$inferInsert>,
) {
  await db.update(memberGrade).set(compact(values)).where(eq(memberGrade.id, gradeId));
}

/** Moves the grades of the given memberships from one status to another. */
export async function moveStatus(
  db: DbOrTx,
  periodId: string,
  membershipIds: string[],
  from: GradeStatus,
  to: GradeStatus,
) {
  if (membershipIds.length === 0) return 0;
  const rows = await db
    .update(memberGrade)
    .set({ status: to })
    .where(
      and(
        eq(memberGrade.gradePeriodId, periodId),
        inArray(memberGrade.membershipId, membershipIds),
        eq(memberGrade.status, from),
      ),
    )
    .returning({ id: memberGrade.id });
  return rows.length;
}

/** Published grades of a user's memberships. */
export function findPublishedGradesOfUser(db: DbOrTx, userId: string, periodIds: string[]) {
  if (periodIds.length === 0) return Promise.resolve([]);
  return db
    .select({
      periodId: memberGrade.gradePeriodId,
      involvementPoints: memberGrade.involvementPoints,
      finalScore: memberGrade.finalScore,
      comment: memberGrade.comment,
    })
    .from(memberGrade)
    .innerJoin(membership, eq(membership.id, memberGrade.membershipId))
    .where(
      and(
        eq(membership.userId, userId),
        inArray(memberGrade.gradePeriodId, periodIds),
        eq(memberGrade.status, "published"),
      ),
    );
}
