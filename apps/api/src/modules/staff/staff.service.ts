import type {
  CheckinDto,
  CreateStaffSlotInput,
  StaffSlotDto,
  UpdateStaffSlotInput,
} from "@bde/shared";
import type { AuthedCtx, Ctx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction } from "../../core/tx";
import { eventAttendances, recordAttendance } from "../checkin";
import { canManageEvent, type EventRow, findManageableEvent, findVisibleEvent } from "../events";
import {
  countValidated,
  deleteAssignment,
  deleteSlot,
  findAssignment,
  findAssignmentOf,
  findAssignments,
  findCurrentMemberships,
  findSlot,
  findSlots,
  findUser,
  insertAssignment,
  insertSlot,
  lockSlot,
  type StaffSlotRow,
  updateAssignment,
  updateSlot as updateSlotRow,
} from "./staff.repo";

const slotNotFound = () => new AppError("NOT_FOUND", 404, "Ce créneau n'existe pas.");

function slotFull(slot: StaffSlotRow) {
  return new AppError(
    "STAFF_SLOT_FULL",
    409,
    `Le créneau « ${slot.label} » est complet (${slot.capacity} place${slot.capacity > 1 ? "s" : ""}).`,
  );
}

/** Slot and event, the event being visible to the user. */
async function visibleSlot(
  ctx: Ctx,
  slotId: string,
): Promise<{ slot: StaffSlotRow; event: EventRow }> {
  const slot = await findSlot(ctx.db, slotId);
  if (!slot) throw slotNotFound();
  return { slot, event: await findVisibleEvent(ctx, slot.eventId) };
}

async function manageableSlot(ctx: AuthedCtx, slotId: string) {
  const slot = await findSlot(ctx.db, slotId);
  if (!slot) throw slotNotFound();
  return { slot, event: await findManageableEvent(ctx, slot.eventId) };
}

async function requireMembership(ctx: Pick<Ctx, "db">, userId: string, message: string) {
  const memberships = await findCurrentMemberships(ctx.db, userId);
  if (memberships.length === 0) throw new AppError("NOT_A_MEMBER", 422, message);
  return memberships;
}

/**
 * Slots of an event. Members see the slots and their own assignment; organisers also see
 * every assignment with the staff check-in status. Students see nothing.
 */
export async function listSlots(ctx: Ctx, eventId: string): Promise<StaffSlotDto[]> {
  const event = await findVisibleEvent(ctx, eventId);
  const manager = canManageEvent(ctx, event);
  if (!manager && !ctx.roles.includes("member")) return [];

  const slots = await findSlots(ctx.db, event.id);
  const assignments = await findAssignments(
    ctx.db,
    slots.map((s) => s.id),
  );
  const checkedIn = manager
    ? new Map(
        (await eventAttendances(ctx, event.id))
          .filter((a) => a.kind === "staff")
          .map((a) => [a.user.id, a.checkedInAt.toISOString()]),
      )
    : new Map<string, string>();

  return slots.map((slot) => {
    const ofSlot = assignments.filter((a) => a.slotId === slot.id);
    const mine = ofSlot.find((a) => a.user.id === ctx.user?.id);
    return {
      id: slot.id,
      label: slot.label,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      capacity: slot.capacity,
      validatedCount: ofSlot.filter((a) => a.status === "validated").length,
      mine: mine ? { id: mine.id, status: mine.status } : null,
      assignments: manager
        ? ofSlot.map((a) => ({
            id: a.id,
            status: a.status,
            user: a.user,
            pole: a.pole,
            checkedInAt: checkedIn.get(a.user.id) ?? null,
          }))
        : [],
    };
  });
}

export async function createSlot(ctx: AuthedCtx, eventId: string, input: CreateStaffSlotInput) {
  const event = await findManageableEvent(ctx, eventId);
  await insertSlot(ctx.db, {
    eventId: event.id,
    label: input.label,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    capacity: input.capacity,
  });
  return listSlots(ctx, event.id);
}

export async function updateSlot(ctx: AuthedCtx, slotId: string, input: UpdateStaffSlotInput) {
  const { slot, event } = await manageableSlot(ctx, slotId);
  const startsAt = input.startsAt ? new Date(input.startsAt) : slot.startsAt;
  const endsAt = input.endsAt ? new Date(input.endsAt) : slot.endsAt;
  if (endsAt <= startsAt) {
    throw new AppError("VALIDATION_ERROR", 400, "La fin doit être après le début", {
      issues: [{ path: ["endsAt"], message: "La fin doit être après le début" }],
    });
  }
  await inTransaction(ctx.db, async (tx) => {
    await lockSlot(tx, slot.id);
    if (input.capacity !== undefined && input.capacity < (await countValidated(tx, slot.id))) {
      throw new AppError(
        "STAFF_SLOT_FULL",
        409,
        "Des membres déjà validés occupent plus de places : retire-les d'abord.",
      );
    }
    await updateSlotRow(tx, slot.id, {
      label: input.label,
      capacity: input.capacity,
      startsAt: input.startsAt ? startsAt : undefined,
      endsAt: input.endsAt ? endsAt : undefined,
    });
  });
  return listSlots(ctx, event.id);
}

export async function removeSlot(ctx: AuthedCtx, slotId: string): Promise<void> {
  const { slot } = await manageableSlot(ctx, slotId);
  await deleteSlot(ctx.db, slot.id);
}

/** A member offers to staff a slot; the organiser validates later. */
export async function volunteer(ctx: AuthedCtx, slotId: string, now: Date = new Date()) {
  const { slot, event } = await visibleSlot(ctx, slotId);
  if (event.status !== "published" || now >= event.endsAt) {
    throw new AppError(
      "REGISTRATION_CLOSED",
      409,
      "On ne peut se proposer que sur un événement publié et pas encore terminé.",
    );
  }
  const memberships = await requireMembership(
    ctx,
    ctx.user.id,
    "Seuls les membres du BDE peuvent faire partie du staff.",
  );
  const existing = await findAssignmentOf(
    ctx.db,
    slot.id,
    memberships.map((m) => m.id),
  );
  if (existing) {
    throw new AppError(
      "ALREADY_VOLUNTEERED",
      409,
      existing.status === "declined"
        ? "Le responsable a déjà refusé ta proposition sur ce créneau."
        : "Tu t'es déjà proposé·e sur ce créneau.",
    );
  }
  // Prefer the membership of the organising pole, for the grade of that pole.
  const chosen = memberships.find((m) => m.poleId === event.poleId) ?? memberships[0];
  if (!chosen) throw new AppError("NOT_A_MEMBER", 422, "Aucune adhésion trouvée.");
  await insertAssignment(ctx.db, { staffSlotId: slot.id, membershipId: chosen.id });
  return listSlots(ctx, event.id);
}

/** A member withdraws, until the event starts. */
export async function withdraw(ctx: AuthedCtx, slotId: string, now: Date = new Date()) {
  const { slot, event } = await visibleSlot(ctx, slotId);
  const memberships = await findCurrentMemberships(ctx.db, ctx.user.id);
  const mine = await findAssignmentOf(
    ctx.db,
    slot.id,
    memberships.map((m) => m.id),
  );
  if (!mine) throw new AppError("NOT_FOUND", 404, "Tu n'es pas positionné·e sur ce créneau.");
  if (now >= event.startsAt) {
    throw new AppError(
      "DEADLINE_PASSED",
      409,
      "L'événement a commencé : préviens directement le responsable.",
    );
  }
  await deleteAssignment(ctx.db, mine.id);
  return listSlots(ctx, event.id);
}

async function manageableAssignment(ctx: AuthedCtx, assignmentId: string) {
  const assignment = await findAssignment(ctx.db, assignmentId);
  if (!assignment) throw new AppError("NOT_FOUND", 404, "Cette affectation n'existe pas.");
  const { slot, event } = await manageableSlot(ctx, assignment.slotId);
  return { assignment, slot, event };
}

/** Organiser decision on a proposal. Validation respects the slot's capacity. */
export async function decide(
  ctx: AuthedCtx,
  assignmentId: string,
  status: "validated" | "declined",
) {
  const { assignment, slot, event } = await manageableAssignment(ctx, assignmentId);
  await inTransaction(ctx.db, async (tx) => {
    await lockSlot(tx, slot.id);
    if (
      status === "validated" &&
      assignment.status !== "validated" &&
      (await countValidated(tx, slot.id)) >= slot.capacity
    ) {
      throw slotFull(slot);
    }
    await updateAssignment(tx, assignment.id, { status, decidedBy: ctx.user.id });
  });
  return listSlots(ctx, event.id);
}

/** Organiser puts a member on a slot directly (validated): assignment or reassignment. */
export async function assign(ctx: AuthedCtx, slotId: string, userId: string) {
  const { slot, event } = await manageableSlot(ctx, slotId);
  const memberships = await requireMembership(
    ctx,
    userId,
    "Cette personne n'est pas membre du BDE cette année.",
  );
  await inTransaction(ctx.db, async (tx) => {
    await lockSlot(tx, slot.id);
    const existing = await findAssignmentOf(
      tx,
      slot.id,
      memberships.map((m) => m.id),
    );
    if (existing?.status === "validated") return;
    if ((await countValidated(tx, slot.id)) >= slot.capacity) throw slotFull(slot);
    if (existing) {
      await updateAssignment(tx, existing.id, { status: "validated", decidedBy: ctx.user.id });
    } else {
      const chosen = memberships.find((m) => m.poleId === event.poleId) ?? memberships[0];
      if (!chosen) throw new AppError("NOT_A_MEMBER", 422, "Aucune adhésion trouvée.");
      await insertAssignment(tx, {
        staffSlotId: slot.id,
        membershipId: chosen.id,
        status: "validated",
        decidedBy: ctx.user.id,
      });
    }
  });
  return listSlots(ctx, event.id);
}

/** Marks a validated staff member present: a `staff` attendance, counted in the grade. */
export async function checkInStaff(ctx: AuthedCtx, assignmentId: string): Promise<CheckinDto> {
  const { assignment, event } = await manageableAssignment(ctx, assignmentId);
  if (assignment.status !== "validated") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      409,
      "Seul un membre validé sur un créneau peut être pointé comme staff.",
    );
  }
  const person = await findUser(ctx.db, assignment.user.id);
  if (!person) throw new AppError("NOT_FOUND", 404, "Ce membre n'existe plus.");
  return recordAttendance(ctx, event, person, "staff");
}
