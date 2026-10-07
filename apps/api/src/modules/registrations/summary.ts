import type { RegistrationStatus } from "@bde/shared";
import type { DbOrTx } from "../../db/client";
import { countConfirmedByEvent, findUserRegistrations } from "./registrations.repo";

export type RegistrationSummary = {
  confirmedCount: number;
  mine: { id: string; status: RegistrationStatus } | null;
};

/**
 * Registration figures shown on events. Used by the events module: it must not import
 * registrations.service (which depends on events) to avoid a cycle.
 */
export async function registrationSummaries(
  db: DbOrTx,
  eventIds: string[],
  userId: string | null,
): Promise<(eventId: string) => RegistrationSummary> {
  const [counts, mine] = await Promise.all([
    countConfirmedByEvent(db, eventIds),
    userId ? findUserRegistrations(db, userId, eventIds) : Promise.resolve([]),
  ]);
  const mineByEvent = new Map(mine.map((r) => [r.eventId, { id: r.id, status: r.status }]));
  return (eventId) => ({
    confirmedCount: counts.get(eventId) ?? 0,
    mine: mineByEvent.get(eventId) ?? null,
  });
}
