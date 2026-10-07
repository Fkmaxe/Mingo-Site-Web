import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EventList } from "@/features/events/event-card";
import { listEvents } from "@/features/events/queries";

export const metadata: Metadata = { title: "Gestion des événements" };

export default async function ManageEventsPage() {
  const [upcoming, past] = await Promise.all([
    listEvents({ scope: "upcoming", manageable: true, limit: 50 }),
    listEvents({ scope: "past", manageable: true, limit: 10 }),
  ]);
  const hrefOf = (event: { id: string }) => `/manage/events/${event.id}`;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl">Mes événements</h1>
        <Button asChild>
          <Link href="/manage/events/new">
            <Plus aria-hidden />
            Créer
          </Link>
        </Button>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-muted-foreground text-sm">À venir et brouillons</h2>
        <EventList events={upcoming.items} hrefOf={hrefOf} empty="Aucun événement à venir." />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-muted-foreground text-sm">Passés</h2>
        <EventList events={past.items} hrefOf={hrefOf} empty="Aucun événement passé." />
      </section>
    </div>
  );
}
