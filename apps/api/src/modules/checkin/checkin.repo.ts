import type { AttendanceKind } from "@bde/shared";
import { and, count, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { attendance } from "../../db/schema";

export async function findAttendance(
  db: DbOrTx,
  eventId: string,
  userId: string,
  kind: AttendanceKind,
) {
  const [row] = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.eventId, eventId),
        eq(attendance.userId, userId),
        eq(attendance.kind, kind),
      ),
    );
  return row;
}

/** Returns the new row, or undefined if it already existed (concurrent scan). */
export async function insertAttendance(db: DbOrTx, values: typeof attendance.$inferInsert) {
  const [row] = await db.insert(attendance).values(values).onConflictDoNothing().returning();
  return row;
}

export async function countAttendances(db: DbOrTx, eventId: string, kind: AttendanceKind) {
  const [row] = await db
    .select({ n: count() })
    .from(attendance)
    .where(and(eq(attendance.eventId, eventId), eq(attendance.kind, kind)));
  return row?.n ?? 0;
}

export async function findAttendancesOfUsers(
  db: DbOrTx,
  eventId: string,
  userIds: string[],
  kind: AttendanceKind,
) {
  if (userIds.length === 0) return [];
  return db
    .select({ userId: attendance.userId, checkedInAt: attendance.checkedInAt })
    .from(attendance)
    .where(
      and(
        eq(attendance.eventId, eventId),
        eq(attendance.kind, kind),
        inArray(attendance.userId, userIds),
      ),
    );
}
