import { Trophy } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LiveLink } from "./live-link";
import { TournamentBoard } from "./tournament-board";
import type { EventLeague } from "./types";

const MEDALS = [
  "bg-brand-pink text-brand-pink-foreground",
  "bg-brand-cyan text-brand-navy",
  "bg-brand-lavender text-brand-navy",
];

/** Event page: what the event counts for, its validated placements and its tournament. */
export function EventLeagueSection({ league, slug }: { league: EventLeague; slug: string }) {
  if (!league.sport && !league.tournament) return null;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="event-league-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="event-league-title" className="font-bold font-display text-lg">
          {league.tournament ? "Tournoi" : "Ligue sportive"}
        </h2>
        {league.sport ? (
          <Link
            href="/ligue"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary/10 px-3 font-semibold text-primary text-sm"
          >
            <Trophy aria-hidden className="size-4" />
            Ligue · {league.sport.name}
          </Link>
        ) : null}
      </div>
      {league.results ? (
        <ol className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          {league.results.placements.map((p) => (
            <li key={p.place} className="flex min-h-10 items-center gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-sm",
                  MEDALS[p.place - 1] ?? "bg-muted",
                )}
              >
                {p.place}
              </span>
              <span className="font-semibold">{p.name}</span>
            </li>
          ))}
        </ol>
      ) : league.sport ? (
        <p className="text-muted-foreground text-sm">
          Compte pour la ligue : 1 point si tu viens (pointé à l'entrée), plus un bonus pour le Top
          5.
        </p>
      ) : null}
      {league.tournament ? (
        <>
          <TournamentBoard tournament={league.tournament} />
          <LiveLink slug={slug} />
        </>
      ) : null}
    </section>
  );
}
