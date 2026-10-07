import { z } from "zod";
import { STAFF_ASSIGNMENT_STATUSES } from "../enums";

const IsoDateTime = z.iso.datetime({ offset: true, message: "Date invalide" });

const StaffSlotFields = z.object({
  label: z.string().trim().min(1, "Le nom du créneau est obligatoire").max(80, "Nom trop long"),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  capacity: z
    .int("Le nombre de places doit être entier")
    .positive("Au moins 1 place")
    .max(200, "200 places maximum"),
});

const checkSlotDates = (
  value: { startsAt?: string | undefined; endsAt?: string | undefined },
  ctx: z.RefinementCtx,
) => {
  if (value.startsAt && value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "La fin doit être après le début" });
  }
};

export const CreateStaffSlotInput = StaffSlotFields.superRefine(checkSlotDates).meta({
  id: "CreateStaffSlotInput",
});
export type CreateStaffSlotInput = z.infer<typeof CreateStaffSlotInput>;

export const UpdateStaffSlotInput = StaffSlotFields.partial()
  .superRefine(checkSlotDates)
  .meta({ id: "UpdateStaffSlotInput" });
export type UpdateStaffSlotInput = z.infer<typeof UpdateStaffSlotInput>;

export const StaffAssignmentDto = z
  .object({
    id: z.uuid(),
    status: z.enum(STAFF_ASSIGNMENT_STATUSES),
    user: z.object({ id: z.uuid(), name: z.string(), promo: z.string().nullable() }),
    pole: z.string().nullable(),
    checkedInAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "StaffAssignment" });
export type StaffAssignmentDto = z.infer<typeof StaffAssignmentDto>;

export const StaffSlotDto = z
  .object({
    id: z.uuid(),
    label: z.string(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    capacity: z.int(),
    validatedCount: z.int(),
    /** The current user's assignment on this slot. */
    mine: z.object({ id: z.uuid(), status: z.enum(STAFF_ASSIGNMENT_STATUSES) }).nullable(),
    /** Only for organisers (empty otherwise). */
    assignments: z.array(StaffAssignmentDto),
  })
  .meta({ id: "StaffSlot" });
export type StaffSlotDto = z.infer<typeof StaffSlotDto>;

export const AssignStaffInput = z
  .object({ userId: z.uuid("Membre invalide") })
  .meta({ id: "AssignStaffInput" });
