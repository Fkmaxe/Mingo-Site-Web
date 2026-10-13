import type { StudyRhythm } from "@bde/shared";

export type LevelRules = { name: string; alternanceOnly: boolean; trackIds: readonly string[] };

/**
 * A student's class as saved: the programme must be offered in that year (a year without listed
 * programmes offers them all), and an alternance-only year forces work-study.
 */
export function resolveClass(
  level: LevelRules | null,
  trackId: string | null,
  rhythm: StudyRhythm | null,
): { ok: true; rhythm: StudyRhythm | null } | { ok: false; message: string } {
  if (level && trackId && level.trackIds.length > 0 && !level.trackIds.includes(trackId)) {
    return { ok: false, message: `Cette filière n'est pas proposée en ${level.name}.` };
  }
  return { ok: true, rhythm: level?.alternanceOnly ? "alternance" : rhythm };
}
