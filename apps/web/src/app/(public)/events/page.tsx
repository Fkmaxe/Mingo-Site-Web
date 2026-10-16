import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/brand";
import { SegmentedNav } from "@/components/segmented-nav";
import { Button } from "@/components/ui/button";
import { EventList } from "@/features/events/event-card";
import { listEvents } from "@/features/events/queries";
import { HOME, SITE_HOME } from "@/lib/breadcrumbs";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Événements" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const scope = params.scope === "past" ? "past" : "upcoming";
  const [page, me] = await Promise.all([listEvents({ scope, cursor: params.cursor }), getMe()]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Événements" breadcrumb={[me ? HOME : SITE_HOME]} />
      <SegmentedNav
        label="Période"
        fill
        active={scope}
        items={[
          { key: "upcoming", label: "À venir", href: "/events" },
          { key: "past", label: "Passés", href: "/events?scope=past" },
        ]}
      />
      <EventList
        events={page.items}
        empty={
          scope === "upcoming" ? "Aucun événement prévu pour l'instant." : "Aucun événement passé."
        }
      />
      {page.nextCursor ? (
        <Button asChild variant="outline">
          <Link href={`/events?scope=${scope}&cursor=${encodeURIComponent(page.nextCursor)}`}>
            Voir la suite
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
