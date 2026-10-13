import { z } from "zod";
import { STUDY_RHYTHMS, type StudyRhythm } from "../enums";

export const RHYTHM_LABELS: Record<StudyRhythm, string> = {
  initial: "Initial",
  alternance: "Alternance",
};

/** Letter of the rhythm in a class code, for a programme without its own code (tronc commun). */
export const RHYTHM_CODES: Record<StudyRhythm, string> = { initial: "I", alternance: "A" };

/** Classes of a year are numbered 1 to 9 (4AL1, 1A3, 2I8). */
export const CLASS_NUMBER_MAX = 9;

export const JANUARY_INTAKE_LABEL = "Rentrée de janvier";

/**
 * ESGI class code: code of the year, then code of the programme (AL, SRC…) or, for a programme
 * without one, the letter of the rhythm (A = alternance, I = initial), then the class number.
 * "4AL1", "1A3", "2I8". Null without a year code or a class number.
 */
export function classCode(
  levelCode: string | null | undefined,
  trackCode: string | null | undefined,
  rhythm: StudyRhythm | null | undefined,
  classNumber: number | null | undefined,
): string | null {
  if (!levelCode || !classNumber) return null;
  return `${levelCode}${trackCode || (rhythm ? RHYTHM_CODES[rhythm] : "")}${classNumber}`;
}

/**
 * "4AL1 · 4A · Architecture logicielle", "1A · MCSI · Alternance", "3A" or null: the label shown
 * everywhere a class is displayed. The rhythm is left out where work-study is mandatory (pass
 * null). Same rule as refreshPromo in the API, which stores it in `user.promo`.
 */
export function promoLabel({
  code = null,
  level,
  track,
  rhythm = null,
  januaryIntake = false,
}: {
  code?: string | null;
  level: string | null | undefined;
  track: string | null | undefined;
  rhythm?: StudyRhythm | null;
  januaryIntake?: boolean;
}) {
  const parts = [
    code,
    level,
    track,
    rhythm ? RHYTHM_LABELS[rhythm] : null,
    januaryIntake && level ? JANUARY_INTAKE_LABEL : null,
  ].filter((p): p is string => Boolean(p?.trim()));
  return parts.length > 0 ? parts.join(" · ") : null;
}

const ClassRef = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Short code used in the class code ("4", "AL"); null when not set. */
  code: z.string().nullable(),
  userCount: z.int(),
});

export const ClassesDto = z
  .object({
    /** In order (position). */
    levels: z.array(
      ClassRef.extend({
        position: z.int(),
        /** Work-study only (from 3rd year at ESGI): no initial / work-study choice. */
        alternanceOnly: z.boolean(),
        /** Programmes offered this year; empty = all of them. */
        trackIds: z.array(z.uuid()),
      }),
    ),
    tracks: z.array(ClassRef),
  })
  .meta({ id: "Classes" });
export type ClassesDto = z.infer<typeof ClassesDto>;

const ClassName = z.string().trim().min(1, "Donne un nom").max(40, "40 caractères maximum");

/** Short code of a year or programme ("4", "AL"); empty = none. */
const ClassCodeInput = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{0,6}$/, "6 lettres ou chiffres maximum, sans espace")
  .nullable()
  .optional();

export const ClassLevelInput = z
  .object({
    name: ClassName,
    code: ClassCodeInput,
    position: z.int().min(0).max(10_000).optional(),
    alternanceOnly: z.boolean().optional(),
    trackIds: z.array(z.uuid()).max(50).optional(),
  })
  .meta({ id: "ClassLevelInput" });
export type ClassLevelInput = z.infer<typeof ClassLevelInput>;

export const TrackInput = z
  .object({ name: ClassName, code: ClassCodeInput })
  .meta({ id: "TrackInput" });
export type TrackInput = z.infer<typeof TrackInput>;

/**
 * A student's own class (year of study, programme, rhythm, class number, January intake), all
 * optional; the class number is required once a year is chosen.
 */
export const UpdateClassInput = z
  .object({
    levelId: z.uuid().nullable(),
    trackId: z.uuid().nullable(),
    rhythm: z.enum(STUDY_RHYTHMS).nullable().default(null),
    classNumber: z
      .int("Choisis ton numéro de classe")
      .min(1, "Choisis ton numéro de classe")
      .max(CLASS_NUMBER_MAX, "Choisis ton numéro de classe")
      .nullable()
      .default(null),
    januaryIntake: z.boolean().default(false),
  })
  .refine((v) => v.levelId === null || v.classNumber !== null, {
    message: "Choisis ton numéro de classe",
    path: ["classNumber"],
  })
  .meta({ id: "UpdateClassInput" });
export type UpdateClassInput = z.input<typeof UpdateClassInput>;
export type UpdateClassData = z.output<typeof UpdateClassInput>;
