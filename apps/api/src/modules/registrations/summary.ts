import type { RegistrationStatus } from "@bde/shared";
import type { DbOrTx } from "../../db/client";
import {
  countConfirmedByEvent,
  countWaitlistedByEvent,
  findUserRegistrations,
  findWaitlistRanks,
} from "./registrations.repo";
import { countTeamsByEvent } from "./teams.repo";

export type RegistrationSummary = {
  confirmedCount: number;
  waitlistCount: number;
  confirmedTeamCount: number;
  waitlistTeamCount: number;
  mine: { id: string; status: RegistrationStatus; waitlistPosition: number | null } | null;
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
  const [counts, waitlisted, teams, mine] = await Promise.all([
    countConfirmedByEvent(db, eventIds),
    countWaitlistedByEvent(db, eventIds),
    countTeamsByEvent(db, eventIds),
    userId ? findUserRegistrations(db, userId, eventIds) : Promise.resolve([]),
  ]);
  const ranks = await findWaitlistRanks(
    db,
    mine.filter((r) => r.status === "waitlisted").map((r) => r.id),
  );
  const mineByEvent = new Map(
    mine.map((r) => [
      r.eventId,
      { id: r.id, status: r.status, waitlistPosition: ranks.get(r.id) ?? null },
    ]),
  );
  return (eventId) => ({
    confirmedCount: counts.get(eventId) ?? 0,
    waitlistCount: waitlisted.get(eventId) ?? 0,
    confirmedTeamCount: teams.get(eventId)?.confirmed ?? 0,
    waitlistTeamCount: teams.get(eventId)?.waitlisted ?? 0,
    mine: mineByEvent.get(eventId) ?? null,
  });
}
