/** "2026-11" of a Paris day "2026-11-14". */
export const monthOf = (day: string) => day.slice(0, 7);

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The month shifted by `delta` months ("2026-12" + 1 → "2027-01"). */
export function shiftMonth(month: string, delta: number): string {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return iso(d).slice(0, 7);
}

/**
 * The weeks of a month view, Monday first, overflowing on the months around so that every
 * week is complete (5 or 6 weeks).
 */
export function monthWeeks(month: string): string[][] {
  const first = new Date(`${month}-01T12:00:00Z`);
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const weeks: string[][] = [];
  const day = new Date(start);
  while (day <= last || weeks.length === 0 || (weeks.at(-1)?.length ?? 0) < 7) {
    if ((weeks.at(-1)?.length ?? 7) === 7) weeks.push([]);
    weeks.at(-1)?.push(iso(day));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return weeks;
}

/** A valid "YYYY-MM" from the URL, or the fallback. */
export function parseMonth(value: string | undefined, fallback: string): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback;
}
