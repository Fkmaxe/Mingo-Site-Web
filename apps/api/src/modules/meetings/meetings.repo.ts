import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import { meeting, meetingAttendance, membership, pole, schoolYear, user } from "../../db/schema";

export type MeetingRow = NonNullable<Awaited<ReturnType<typeof findMeeting>>>;

const selection = { meeting, pole: { id: pole.id, name: pole.name } };

/** Visible meetings: general ones, and those of `poleIds` ("all" for the board). */
export function findMeetings(
  db: DbOrTx,
  params: { poleIds: "all" | string[]; scope: "upcoming" | "past"; since: Date },
) {
  const poleFilter =
    params.poleIds === "all"
      ? undefined
      : params.poleIds.length > 0
        ? or(isNull(meeting.poleId), inArray(meeting.poleId, params.poleIds))
        : isNull(meeting.poleId);
  const upcoming = params.scope === "upcoming";
  return db
    .select(selection)
    .from(meeting)
    .leftJoin(pole, eq(pole.id, meeting.poleId))
    .where(
      and(
        isNull(meeting.deletedAt),
        poleFilter,
        upcoming ? gte(meeting.startsAt, params.since) : lt(meeting.startsAt, params.since),
      ),
    )
    .orderBy(upcoming ? asc(meeting.startsAt) : desc(meeting.startsAt))
    .limit(100);
}

export async function findMeeting(db: DbOrTx, meetingId: string) {
  const [row] = await db
    .select(selection)
    .from(meeting)
    .leftJoin(pole, eq(pole.id, meeting.poleId))
    .where(and(eq(meeting.id, meetingId), isNull(meeting.deletedAt)));
  return row;
}

export async function insertMeeting(db: DbOrTx, values: typeof meeting.$inferInsert) {
  const [row] = await db.insert(meeting).values(values).returning({ id: meeting.id });
  if (!row) throw new Error("insertMeeting: aucune ligne");
  return row.id;
}

export async function updateMeeting(
  db: DbOrTx,
  meetingId: string,
  values: Patch<typeof meeting.$inferInsert>,
) {
  const changes = compact(values);
  if (!changes) return;
  await db.update(meeting).set(changes).where(eq(meeting.id, meetingId));
}

/** Who is expected: members of the pole, or every active member for a general meeting. */
export function findExpectedMembers(db: DbOrTx, poleId: string | null) {
  return db
    .selectDistinct({ id: user.id, name: user.name, promo: user.promo })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .where(
      and(
        eq(schoolYear.isCurrent, true),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
        poleId ? and(eq(membership.poleId, poleId), ne(membership.role, "board")) : undefined,
      ),
    )
    .orderBy(asc(user.name));
}

export async function findPresentUserIds(db: DbOrTx, meetingId: string) {
  const rows = await db
    .select({ userId: meetingAttendance.userId })
    .from(meetingAttendance)
    .where(eq(meetingAttendance.meetingId, meetingId));
  return new Set(rows.map((r) => r.userId));
}

export async function markPresent(db: DbOrTx, meetingId: string, userId: string, markedBy: string) {
  await db.insert(meetingAttendance).values({ meetingId, userId, markedBy }).onConflictDoNothing();
}

export async function markAbsent(db: DbOrTx, meetingId: string, userId: string) {
  await db
    .delete(meetingAttendance)
    .where(and(eq(meetingAttendance.meetingId, meetingId), eq(meetingAttendance.userId, userId)));
}
