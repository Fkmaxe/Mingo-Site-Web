import type { DbOrTx } from "../../db/client";
import { findEventPointTotals } from "./league.repo";

/**
 * Whether the event still counts in the league standings (points validated and not cancelled).
 * Used by the events module before hiding an event: it must not import the league service.
 */
export async function eventHasLeaguePoints(db: DbOrTx, eventId: string): Promise<boolean> {
  const totals = await findEventPointTotals(db, eventId);
  return totals.some((t) => t.total !== 0);
}
