/** Ratio rounded to 3 decimals, capped at 1; null when the denominator is 0. */
export function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.min(1, Math.round((part / whole) * 1000) / 1000);
}

/** Confirmed people who did not come; unknown (null) until the event has started. */
export function noShows(confirmed: number, checkedIn: number, started: boolean): number | null {
  return started ? Math.max(confirmed - checkedIn, 0) : null;
}

/**
 * Meetings a member was expected at: the general meetings (no pole) plus those of each of
 * their poles. `held` maps a pole id (or null for general meetings) to past meetings.
 */
export function meetingsExpected(poleIds: string[], held: Map<string | null, number>): number {
  return [...new Set(poleIds)].reduce((sum, id) => sum + (held.get(id) ?? 0), held.get(null) ?? 0);
}
