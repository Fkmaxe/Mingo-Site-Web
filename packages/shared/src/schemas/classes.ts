import { z } from "zod";
import { STUDY_RHYTHMS, type StudyRhythm } from "../enums";

export const RHYTHM_LABELS: Record<StudyRhythm, string> = {
  initial: "Initial",
  alternance: "Alternance",
};

/**
 * "1A · MCSI · Alternance", "3A · Sécurité", "3A" or null: the label shown everywhere a class is
 * displayed. The rhythm is left out where work-study is mandatory (pass null).
 */
export function promoLabel(
  level: string | null | undefined,
  track: string | null | undefined,
  rhythm: StudyRhythm | null = null,
) {
  const parts = [level, track, rhythm ? RHYTHM_LABELS[rhythm] : null].filter((p): p is string =>
    Boolean(p?.trim()),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

const ClassRef = z.object({ id: z.uuid(), name: z.string(), userCount: z.int() });

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

export const ClassLevelInput = z
  .object({
    name: ClassName,
    position: z.int().min(0).max(10_000).optional(),
    alternanceOnly: z.boolean().optional(),
    trackIds: z.array(z.uuid()).max(50).optional(),
  })
  .meta({ id: "ClassLevelInput" });
export type ClassLevelInput = z.infer<typeof ClassLevelInput>;

export const TrackInput = z.object({ name: ClassName }).meta({ id: "TrackInput" });

/** A student's own class (year of study, programme, rhythm), all optional. */
export const UpdateClassInput = z
  .object({
    levelId: z.uuid().nullable(),
    trackId: z.uuid().nullable(),
    rhythm: z.enum(STUDY_RHYTHMS).nullable().default(null),
  })
  .meta({ id: "UpdateClassInput" });
export type UpdateClassInput = z.input<typeof UpdateClassInput>;
export type UpdateClassData = z.output<typeof UpdateClassInput>;
