import { z } from "zod";

const IsoDateTime = z.iso.datetime({ offset: true, message: "Date invalide" });

const MeetingFields = z.object({
  /** Null: general meeting of the whole BDE (board only). */
  poleId: z.uuid("Pôle invalide").nullable(),
  title: z.string().trim().min(1, "Le titre est obligatoire").max(120, "Titre trop long"),
  startsAt: IsoDateTime,
  location: z.string().trim().max(200, "Lieu trop long"),
  agenda: z.string().trim().max(5000, "Ordre du jour trop long"),
  minutes: z.string().trim().max(20000, "Compte rendu trop long"),
});

export const CreateMeetingInput = MeetingFields.omit({ minutes: true })
  .extend({
    location: MeetingFields.shape.location.default(""),
    agenda: MeetingFields.shape.agenda.default(""),
  })
  .meta({ id: "CreateMeetingInput" });
export type CreateMeetingInput = z.input<typeof CreateMeetingInput>;
export type CreateMeetingData = z.output<typeof CreateMeetingInput>;

/** The pole of a meeting cannot change. */
export const UpdateMeetingInput = MeetingFields.omit({ poleId: true })
  .partial()
  .meta({ id: "UpdateMeetingInput" });
export type UpdateMeetingData = z.output<typeof UpdateMeetingInput>;

export const ListMeetingsQuery = z.object({
  scope: z.enum(["upcoming", "past"]).default("upcoming"),
});

export const MeetingAttendeeDto = z
  .object({
    user: z.object({ id: z.uuid(), name: z.string(), promo: z.string().nullable() }),
    present: z.boolean(),
  })
  .meta({ id: "MeetingAttendee" });

export const MeetingDto = z
  .object({
    id: z.uuid(),
    title: z.string(),
    startsAt: z.iso.datetime(),
    location: z.string(),
    agenda: z.string(),
    minutes: z.string(),
    /** Null: general meeting. */
    pole: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    canManage: z.boolean(),
    /** Whether the current user was marked present. */
    present: z.boolean(),
    /** Expected members with their presence: organisers only (empty otherwise). */
    attendees: z.array(MeetingAttendeeDto),
  })
  .meta({ id: "Meeting" });
export type MeetingDto = z.infer<typeof MeetingDto>;

export const SetAttendanceInput = z
  .object({ userId: z.uuid(), present: z.boolean() })
  .meta({ id: "SetAttendanceInput" });
