import { z } from "zod";
import { GRADE_STATUSES } from "../enums";

/** Points are stored with 2 decimals (e.g. 0.5 point per presence). */
const Points = z
  .number("Indique un nombre")
  .min(0, "Pas de points négatifs")
  .max(1000, "Trop de points")
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, "2 décimales maximum");

const IsoDate = z.iso.date("Date invalide (AAAA-MM-JJ)");

/** Grade = min(scale, presence points + pole points) (docs/context.md). */
export function computeFinalScore(presence: number, involvement: number, scaleMax: number): number {
  return Math.round(Math.min(scaleMax, presence + involvement) * 100) / 100;
}

const GradePeriodFields = z.object({
  label: z.string().trim().min(1, "Le nom est obligatoire").max(60, "Nom trop long"),
  startsOn: IsoDate,
  endsOn: IsoDate,
  scaleMax: z
    .int("Le barème doit être entier")
    .min(1, "Barème invalide")
    .max(100, "Barème trop grand"),
  pointsPerPresence: Points,
});

const checkPeriodDates = (
  value: { startsOn?: string | undefined; endsOn?: string | undefined },
  ctx: z.RefinementCtx,
) => {
  if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
    ctx.addIssue({ code: "custom", path: ["endsOn"], message: "La fin doit être après le début" });
  }
};

export const CreateGradePeriodInput = GradePeriodFields.extend({
  scaleMax: GradePeriodFields.shape.scaleMax.default(20),
  pointsPerPresence: GradePeriodFields.shape.pointsPerPresence.default(1),
})
  .superRefine(checkPeriodDates)
  .meta({ id: "CreateGradePeriodInput" });
export type CreateGradePeriodInput = z.input<typeof CreateGradePeriodInput>;
export type CreateGradePeriodData = z.output<typeof CreateGradePeriodInput>;

export const UpdateGradePeriodInput = GradePeriodFields.partial()
  .superRefine(checkPeriodDates)
  .meta({ id: "UpdateGradePeriodInput" });
export type UpdateGradePeriodData = z.output<typeof UpdateGradePeriodInput>;

export const GradePeriodDto = z
  .object({
    id: z.uuid(),
    label: z.string(),
    startsOn: z.string(),
    endsOn: z.string(),
    scaleMax: z.int(),
    pointsPerPresence: z.number(),
  })
  .meta({ id: "GradePeriod" });
export type GradePeriodDto = z.infer<typeof GradePeriodDto>;

export const PresenceDto = z
  .object({
    eventId: z.uuid(),
    title: z.string(),
    startsAt: z.iso.datetime(),
    points: z.number(),
  })
  .meta({ id: "Presence" });

export const MemberGradeDto = z
  .object({
    /** Null until a grade has been saved for this member and period. */
    id: z.uuid().nullable(),
    membershipId: z.uuid(),
    user: z.object({ id: z.uuid(), name: z.string(), promo: z.string().nullable() }),
    pole: z.object({ id: z.uuid(), name: z.string() }),
    status: z.enum(GRADE_STATUSES),
    /** Live while draft or submitted, frozen at validation. */
    presencePoints: z.number(),
    presenceCount: z.int(),
    involvementPoints: z.number(),
    finalScore: z.number(),
    comment: z.string(),
  })
  .meta({ id: "MemberGrade" });
export type MemberGradeDto = z.infer<typeof MemberGradeDto>;

export const ListGradesQuery = z.object({ poleId: z.uuid().optional() });

export const SaveGradeInput = z
  .object({
    membershipId: z.uuid(),
    involvementPoints: Points,
    comment: z.string().trim().max(1000, "Commentaire trop long").default(""),
  })
  .meta({ id: "SaveGradeInput" });
export type SaveGradeInput = z.input<typeof SaveGradeInput>;

export const SubmitGradesInput = z.object({ poleId: z.uuid() }).meta({ id: "SubmitGradesInput" });

export const GradeIdsInput = z
  .object({ ids: z.array(z.uuid()).min(1, "Sélectionne au moins une note").max(200) })
  .meta({ id: "GradeIdsInput" });

export const MyGradesDto = z
  .object({
    periods: z.array(
      z.object({
        period: GradePeriodDto,
        presences: z.array(PresenceDto),
        presencePoints: z.number(),
        /** Only once published. */
        grade: z
          .object({ involvementPoints: z.number(), finalScore: z.number(), comment: z.string() })
          .nullable(),
      }),
    ),
  })
  .meta({ id: "MyGrades" });
export type MyGradesDto = z.infer<typeof MyGradesDto>;
