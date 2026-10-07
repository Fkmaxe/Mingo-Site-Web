import type { Metadata } from "next";
import Link from "next/link";
import { EventList } from "@/features/events/event-card";
import { listEvents } from "@/features/events/queries";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Accueil" };

export default async function HomePage() {
  const [me, upcoming] = await Promise.all([requireMe(), listEvents({ limit: 3 })]);
  const firstName = me.name.split(" ")[0];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-2xl">Salut {firstName} 👋</h1>
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-lg">Prochains événements</h2>
          <Link href="/events" className="text-primary text-sm underline-offset-4 hover:underline">
            Tout voir
          </Link>
        </div>
        <EventList events={upcoming.items} empty="Aucun événement prévu pour l'instant." />
      </section>
    </div>
  );
}
