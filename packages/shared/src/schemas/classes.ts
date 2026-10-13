import { z } from "zod";

/** "3A · Dev", "3A", "Dev" or null: the label shown everywhere a class is displayed. */
export function promoLabel(level: string | null | undefined, track: string | null | undefined) {
  const parts = [level, track].filter((p): p is string => Boolean(p?.trim()));
  return parts.length > 0 ? parts.join(" · ") : null;
}

const ClassRef = z.object({ id: z.uuid(), name: z.string(), userCount: z.int() });

export const ClassesDto = z
  .object({
    /** In order (position). */
    levels: z.array(ClassRef.extend({ position: z.int() })),
    tracks: z.array(ClassRef),
  })
  .meta({ id: "Classes" });
export type ClassesDto = z.infer<typeof ClassesDto>;

const ClassName = z.string().trim().min(1, "Donne un nom").max(40, "40 caractères maximum");

export const ClassLevelInput = z
  .object({ name: ClassName, position: z.int().min(0).max(10_000).optional() })
  .meta({ id: "ClassLevelInput" });

export const TrackInput = z.object({ name: ClassName }).meta({ id: "TrackInput" });

/** A student's own class (year of study and programme), both optional. */
export const UpdateClassInput = z
  .object({ levelId: z.uuid().nullable(), trackId: z.uuid().nullable() })
  .meta({ id: "UpdateClassInput" });
export type UpdateClassInput = z.infer<typeof UpdateClassInput>;
