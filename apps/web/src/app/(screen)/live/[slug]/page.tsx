import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventOr404 } from "@/features/events/queries";
import { AutoRefresh } from "@/features/league/auto-refresh";
import { LiveBoard } from "@/features/league/live-board";
import { getEventLeague } from "@/features/league/queries";
import { formatTime } from "@/lib/paris-time";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventOr404((await params).slug);
  return { title: `En direct · ${event.title}` };
}

/** Live screen of an event's tournament, refreshed every 10 seconds. */
export default async function LivePage({ params }: Props) {
  const { slug } = await params;
  const [event, league] = await Promise.all([getEventOr404(slug), getEventLeague(slug)]);
  if (!league) notFound();
  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-6 lg:gap-8">
      <AutoRefresh seconds={10} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-primary text-sm uppercase tracking-wide lg:text-xl">
            {league.sport ? `Ligue · ${league.sport.name}` : "Tournoi"}
          </p>
          <h1 className="font-bold font-display text-3xl lg:text-6xl">{event.title}</h1>
        </div>
        <p className="text-muted-foreground text-sm tabular-nums lg:text-xl">
          Mis à jour à {formatTime(new Date().toISOString())}
        </p>
      </header>
      <LiveBoard league={league} />
    </div>
  );
}
