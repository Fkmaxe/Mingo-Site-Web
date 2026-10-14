import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { EventList } from "@/features/events/event-card";
import { listEvents } from "@/features/events/queries";
import { HOME, SITE_HOME } from "@/lib/breadcrumbs";
import { getMe } from "@/lib/session";
import { cn } from "@/lib/utils";

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
      <nav aria-label="Période" className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
        {(
          [
            ["upcoming", "À venir"],
            ["past", "Passés"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={value === "upcoming" ? "/events" : "/events?scope=past"}
            aria-current={scope === value ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center justify-center rounded-md font-medium",
              scope === value ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
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
