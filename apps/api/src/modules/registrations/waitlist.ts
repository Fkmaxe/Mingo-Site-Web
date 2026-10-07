import type { Services } from "../../core/context";
import type { Defer } from "../../core/tx";
import type { DbOrTx } from "../../db/client";
import { promotedEmail } from "./registrations.emails";
import { countConfirmed, findFirstWaitlisted, promoteRegistrations } from "./registrations.repo";

export type PromotableEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  location: string;
  status: string;
  capacity: number | null;
};

export const ticketUrl = (services: Services, registrationId: string) =>
  `${services.webOrigin}/tickets/${registrationId}`;
export const eventUrl = (services: Services, slug: string) =>
  `${services.webOrigin}/events/${slug}`;

/**
 * Gives the free places of a published event to the first waitlisted people (rule 3 of
 * docs/data-model.md) and mails them after the commit. The caller holds the event's
 * registration lock.
 */
export async function fillFreePlaces(
  db: DbOrTx,
  event: PromotableEvent,
  defer: Defer,
  services: Services,
): Promise<number> {
  if (event.status !== "published") return 0;
  const free =
    event.capacity === null ? 10_000 : event.capacity - (await countConfirmed(db, event.id));
  if (free <= 0) return 0;
  const promoted = await findFirstWaitlisted(db, event.id, free);
  await promoteRegistrations(
    db,
    promoted.map((r) => r.id),
  );
  for (const r of promoted) {
    defer(() => services.mailer.send(promotedEmail(r.user, event, ticketUrl(services, r.id))));
  }
  return promoted.length;
}
