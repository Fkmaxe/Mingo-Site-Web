import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import { membership, pole, schoolYear, staffAssignment, staffSlot, user } from "../../db/schema";

export type StaffSlotRow = typeof staffSlot.$inferSelect;

export function findSlots(db: DbOrTx, eventId: string) {
  return db
    .select()
    .from(staffSlot)
    .where(eq(staffSlot.eventId, eventId))
    .orderBy(asc(staffSlot.startsAt), asc(staffSlot.label));
}

export async function findSlot(db: DbOrTx, slotId: string) {
  const [row] = await db.select().from(staffSlot).where(eq(staffSlot.id, slotId));
  return row;
}

export async function insertSlot(db: DbOrTx, values: typeof staffSlot.$inferInsert) {
  const [row] = await db.insert(staffSlot).values(values).returning();
  if (!row) throw new Error("insertSlot: aucune ligne insérée");
  return row;
}

export async function updateSlot(
  db: DbOrTx,
  slotId: string,
  values: Patch<typeof staffSlot.$inferInsert>,
) {
  await db.update(staffSlot).set(compact(values)).where(eq(staffSlot.id, slotId));
}

export async function deleteSlot(db: DbOrTx, slotId: string) {
  await db.delete(staffSlot).where(eq(staffSlot.id, slotId));
}

/** Serializes validations on one slot (capacity check). */
export async function lockSlot(db: DbOrTx, slotId: string) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`staff_slot:${slotId}`}))`);
}

const assignmentSelection = {
  id: staffAssignment.id,
  slotId: staffAssignment.staffSlotId,
  status: staffAssignment.status,
  membershipId: staffAssignment.membershipId,
  user: { id: user.id, name: user.name, promo: user.promo },
  pole: pole.name,
};

export function findAssignments(db: DbOrTx, slotIds: string[]) {
  if (slotIds.length === 0) return Promise.resolve([]);
  return db
    .select(assignmentSelection)
    .from(staffAssignment)
    .innerJoin(membership, eq(membership.id, staffAssignment.membershipId))
    .innerJoin(user, eq(user.id, membership.userId))
    .leftJoin(pole, eq(pole.id, membership.poleId))
    .where(inArray(staffAssignment.staffSlotId, slotIds))
    .orderBy(asc(staffAssignment.createdAt));
}

export async function findAssignment(db: DbOrTx, assignmentId: string) {
  const [row] = await db
    .select(assignmentSelection)
    .from(staffAssignment)
    .innerJoin(membership, eq(membership.id, staffAssignment.membershipId))
    .innerJoin(user, eq(user.id, membership.userId))
    .leftJoin(pole, eq(pole.id, membership.poleId))
    .where(eq(staffAssignment.id, assignmentId));
  return row;
}

export async function countValidated(db: DbOrTx, slotId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(staffAssignment)
    .where(and(eq(staffAssignment.staffSlotId, slotId), eq(staffAssignment.status, "validated")));
  return row?.n ?? 0;
}

export async function findAssignmentOf(db: DbOrTx, slotId: string, membershipIds: string[]) {
  if (membershipIds.length === 0) return undefined;
  const [row] = await db
    .select()
    .from(staffAssignment)
    .where(
      and(
        eq(staffAssignment.staffSlotId, slotId),
        inArray(staffAssignment.membershipId, membershipIds),
      ),
    );
  return row;
}

/** Active memberships of a user in the current school year, oldest first. */
export function findCurrentMemberships(db: DbOrTx, userId: string) {
  return db
    .select({ id: membership.id, poleId: membership.poleId })
    .from(membership)
    .innerJoin(schoolYear, eq(schoolYear.id, membership.schoolYearId))
    .where(
      and(
        eq(membership.userId, userId),
        eq(schoolYear.isCurrent, true),
        eq(membership.isActive, true),
        isNull(membership.deletedAt),
      ),
    )
    .orderBy(asc(membership.createdAt));
}

export async function findUser(db: DbOrTx, userId: string) {
  const [row] = await db
    .select({ id: user.id, name: user.name, promo: user.promo })
    .from(user)
    .where(eq(user.id, userId));
  return row;
}

export async function insertAssignment(db: DbOrTx, values: typeof staffAssignment.$inferInsert) {
  const [row] = await db
    .insert(staffAssignment)
    .values(values)
    .returning({ id: staffAssignment.id });
  if (!row) throw new Error("insertAssignment: aucune ligne insérée");
  return row.id;
}

export async function updateAssignment(
  db: DbOrTx,
  assignmentId: string,
  values: Patch<typeof staffAssignment.$inferInsert>,
) {
  await db.update(staffAssignment).set(compact(values)).where(eq(staffAssignment.id, assignmentId));
}

export async function deleteAssignment(db: DbOrTx, assignmentId: string) {
  await db.delete(staffAssignment).where(eq(staffAssignment.id, assignmentId));
}
