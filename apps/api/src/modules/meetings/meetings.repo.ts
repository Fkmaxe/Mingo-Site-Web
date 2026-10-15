import type { MeetingKind } from "@bde/shared";
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import { meeting, meetingAttendance, membership, pole, schoolYear, user } from "../../db/schema";

export type MeetingRow = NonNullable<Awaited<ReturnType<typeof findMeeting>>>;

const selection = { meeting, pole: { id: pole.id, name: pole.name } };

/**
 * Visible meetings: those of the `kinds` without a pole, and those of `poleIds`; "all" for the
 * board.
 */
export function findMeetings(
  db: DbOrTx,
  params:
    | { visible: "all"; scope: "upcoming" | "past"; since: Date }
    | {
        visible: { kinds: Exclude<MeetingKind, "pole">[]; poleIds: string[] };
        scope: "upcoming" | "past";
        since: Date;
      },
) {
  const { visible } = params;
  const poleFilter =
    visible === "all"
      ? undefined
      : or(
          inArray(meeting.kind, visible.kinds),
          visible.poleIds.length > 0 ? inArray(meeting.poleId, visible.poleIds) : undefined,
        );
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

/**
 * Who is expected: the members of the pole, every active member (general), the bureau, or the
 * bureau and the pole leads.
 */
export function findExpectedMembers(
  db: DbOrTx,
  target: { kind: MeetingKind; poleId: string | null },
) {
  const audience = {
    pole: target.poleId
      ? and(eq(membership.poleId, target.poleId), ne(membership.role, "board"))
      : undefined,
    general: undefined,
    board: eq(membership.role, "board"),
    leads: inArray(membership.role, ["board", "pole_lead"]),
  }[target.kind];
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
        audience,
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
