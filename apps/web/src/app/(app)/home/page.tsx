import type { Metadata } from "next";
import Link from "next/link";
import { EventList } from "@/features/events/event-card";
import { listEvents } from "@/features/events/queries";
import { formatPoints } from "@/features/open-points/labels";
import { getMyOpenPoints } from "@/features/open-points/queries";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Accueil" };

export default async function HomePage() {
  const [me, upcoming, points] = await Promise.all([
    requireMe(),
    listEvents({ limit: 3 }),
    getMyOpenPoints(),
  ]);
  const firstName = me.name.split(" ")[0];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-2xl">Salut {firstName} 👋</h1>
      {points.isMember ? (
        <Link
          href="/tasks"
          className="flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <span className="font-medium">Mes tâches</span>
          <span className="text-muted-foreground text-sm">Voir le tableau du pôle</span>
        </Link>
      ) : null}
      {points.isMember ? (
        <Link
          href="/meetings"
          className="flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <span className="font-medium">Réunions</span>
          <span className="text-muted-foreground text-sm">Ordres du jour, comptes rendus</span>
        </Link>
      ) : (
        <Link
          href="/join"
          className="flex items-center justify-between rounded-xl border border-primary/40 bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <span className="font-medium">Rejoindre le BDE</span>
          <span className="text-muted-foreground text-sm">Candidater à un pôle</span>
        </Link>
      )}
      {points.isMember ? null : (
        <Link
          href="/points"
          className="flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <span className="flex flex-col">
            <span className="text-muted-foreground text-sm">Mes points open</span>
            <span className="font-bold text-2xl text-primary tabular-nums">
              {formatPoints(points.balance)}
            </span>
          </span>
          {points.pending !== 0 ? (
            <span className="text-muted-foreground text-xs">
              + {formatPoints(points.pending)} en attente
            </span>
          ) : null}
        </Link>
      )}
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
