import type { Services } from "../../core/context";
import type { Defer } from "../../core/tx";
import type { DbOrTx } from "../../db/client";
import { promotedPush } from "../push";
import { promotedEmail } from "./registrations.emails";
import { countConfirmed, findFirstWaitlisted, promoteRegistrations } from "./registrations.repo";
import { isTeamEvent } from "./rules";
import { countConfirmedTeams, findFirstWaitlistedTeams, promoteTeams } from "./teams.repo";

export type PromotableEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  location: string;
  status: string;
  /** People, or teams for a team event. */
  capacity: number | null;
  teamMinSize: number | null;
  teamMaxSize: number | null;
};

export const ticketUrl = (services: Services, registrationId: string) =>
  `${services.webOrigin}/tickets/${registrationId}`;
export const eventUrl = (services: Services, slug: string) =>
  `${services.webOrigin}/events/${slug}`;

/**
 * Gives the free places of a published event to the first waitlisted people (rule 3 of
 * docs/data-model.md), or to the first waitlisted teams with all their members for a team
 * event, and mails them after the commit. The caller holds the event's registration lock.
 */
export async function fillFreePlaces(
  db: DbOrTx,
  event: PromotableEvent,
  defer: Defer,
  services: Services,
): Promise<number> {
  if (event.status !== "published") return 0;
  const team = isTeamEvent(event);
  const taken = team ? await countConfirmedTeams(db, event.id) : await countConfirmed(db, event.id);
  const free = event.capacity === null ? 10_000 : event.capacity - taken;
  if (free <= 0) return 0;
  let promoted: { id: string; user: { id: string; name: string; email: string } }[];
  if (team) {
    const teams = await findFirstWaitlistedTeams(db, event.id, free);
    promoted = await promoteTeams(
      db,
      teams.map((t) => t.id),
    );
  } else {
    promoted = await findFirstWaitlisted(db, event.id, free);
    await promoteRegistrations(
      db,
      promoted.map((r) => r.id),
    );
  }
  for (const r of promoted) {
    defer(() => services.mailer.send(promotedEmail(r.user, event, ticketUrl(services, r.id))));
    defer(async () => {
      await services.notifier.notifyUsers([r.user.id], promotedPush(event, r.id));
    });
  }
  return promoted.length;
}
