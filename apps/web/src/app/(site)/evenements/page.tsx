import type { Metadata } from "next";
import { JsonLd } from "@/features/site/components/json-ld";
import { PageHeader } from "@/features/site/components/page-header";
import { eventPhase } from "@/features/site/events";
import { buildBreadcrumb, buildEvent } from "@/features/site/json-ld";
import { buildPageMetadata } from "@/features/site/metadata";
import { getShowcaseEvents, getVisitor } from "@/features/site/queries";
import { eventHref, siteHref } from "@/features/site/routes";
import { EventsBoard, EventsContact } from "@/features/site/sections/events";
import { env } from "@/lib/server-env";

const TITLE = "Événements";

export const metadata: Metadata = buildPageMetadata({
  route: "events",
  title: TITLE,
  description:
    "Le calendrier du BDE Mingo, bureau des étudiants de l'ESGI : les événements en cours, à venir et déjà organisés.",
});

/** Only events still to come are declared as structured data: a past one is not "scheduled". */
export default async function EventsPage() {
  const [me, events] = await Promise.all([getVisitor(), getShowcaseEvents(24)]);
  const now = new Date();
  const scheduled = events.current.filter((event) => eventPhase(event, now) !== "cancelled");
  return (
    <>
      <PageHeader
        eyebrow="Agenda"
        title={TITLE}
        lead="Le BDE Mingo anime la vie étudiante de l'ESGI. Retrouve ici ses rendez-vous, en cours, à venir et déjà passés."
      />
      <EventsBoard current={events.current} past={events.past} now={now} signedIn={me !== null} />
      <EventsContact />
      <JsonLd
        data={buildBreadcrumb(env.SITE_URL, [
          { name: "Accueil", path: siteHref("home") },
          { name: TITLE, path: siteHref("events") },
        ])}
      />
      {scheduled.map((event) => (
        <JsonLd key={event.id} data={buildEvent(env.SITE_URL, event, eventHref(event.slug))} />
      ))}
    </>
  );
}
