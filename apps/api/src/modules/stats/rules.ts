/** Ratio rounded to 3 decimals, capped at 1; null when the denominator is 0. */
export function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.min(1, Math.round((part / whole) * 1000) / 1000);
}

/** Confirmed people who did not come; unknown (null) until the event has started. */
export function noShows(confirmed: number, checkedIn: number, started: boolean): number | null {
  return started ? Math.max(confirmed - checkedIn, 0) : null;
}

/** Past meetings of the year: without a pole by kind, and per pole. */
export type MeetingsHeld = {
  general: number;
  board: number;
  leads: number;
  byPole: Map<string, number>;
};

/**
 * Meetings a member was expected at: the general meetings, those of each of their poles, the
 * bureau meetings for the bureau, and the bureau + leads meetings for the bureau and the leads.
 */
export function meetingsExpected(
  member: { poleIds: string[]; board: boolean; lead: boolean },
  held: MeetingsHeld,
): number {
  const ofPoles = [...new Set(member.poleIds)].reduce(
    (sum, id) => sum + (held.byPole.get(id) ?? 0),
    0,
  );
  return (
    held.general +
    ofPoles +
    (member.board ? held.board : 0) +
    (member.board || member.lead ? held.leads : 0)
  );
}
