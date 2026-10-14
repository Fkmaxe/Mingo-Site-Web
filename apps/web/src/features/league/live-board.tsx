import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveBadge } from "./match-card";
import { TournamentBoard } from "./tournament-board";
import type { EventLeague, Tournament, TournamentMatch } from "./types";

type Located = { match: TournamentMatch; where: string };

/** Every match with where it is played in the tournament ("Poule A", "Demi-finales"…). */
function allMatches(t: Tournament): Located[] {
  return [
    ...t.pools.flatMap((p) => p.matches.map((match) => ({ match, where: p.name }))),
    ...t.rounds.flatMap((r) => r.matches.map((match) => ({ match, where: r.name }))),
    ...(t.thirdPlaceMatch ? [{ match: t.thirdPlaceMatch, where: "Petite finale" }] : []),
  ];
}

const played = (m: TournamentMatch) => m.winnerId !== null || m.draw;

function BigMatch({ match, where, live }: Located & { live: boolean }) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 lg:p-6",
        live && "border-2 border-brand-pink",
      )}
    >
      <div className="flex items-center justify-between gap-3 text-muted-foreground text-sm lg:text-lg">
        <span className="font-semibold">{where}</span>
        {live ? <LiveBadge /> : null}
      </div>
      <div className="flex items-center gap-3 font-bold font-display text-xl lg:text-4xl">
        <span className="min-w-0 flex-1 truncate">{match.a?.name}</span>
        <span aria-hidden className="text-base text-muted-foreground lg:text-2xl">
          vs
        </span>
        <span className="min-w-0 flex-1 truncate text-right">{match.b?.name}</span>
      </div>
    </li>
  );
}

const MEDALS = [
  "bg-brand-pink text-brand-pink-foreground",
  "bg-brand-cyan text-brand-navy",
  "bg-brand-lavender text-brand-navy",
];

function Podium({ names }: { names: string[] }) {
  return (
    <section aria-labelledby="live-podium" className="flex flex-col gap-3">
      <h2
        id="live-podium"
        className="flex items-center gap-2 font-bold font-display text-2xl lg:text-4xl"
      >
        <Trophy aria-hidden className="size-7 text-brand-pink lg:size-10" />
        Classement final
      </h2>
      <ol className="grid gap-3 lg:grid-cols-3">
        {names.slice(0, 3).map((name, i) => (
          <li key={name} className="flex items-center gap-4 rounded-2xl border bg-card p-4 lg:p-6">
            <span
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-full font-bold text-2xl lg:size-16 lg:text-3xl",
                MEDALS[i],
              )}
            >
              {i + 1}
            </span>
            <span className="truncate font-bold font-display text-xl lg:text-3xl">{name}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Live screen of a tournament, for a TV: matches being played, the next ones, then the pools or
 * the bracket, and the podium once it is over.
 */
export function LiveBoard({ league }: { league: EventLeague }) {
  const t = league.tournament;
  if (!t) {
    return (
      <p className="text-center text-muted-foreground text-xl lg:text-3xl">
        Le tournoi n'est pas encore tiré.
      </p>
    );
  }
  const matches = allMatches(t);
  const live = matches.filter((m) => m.match.live);
  const next = matches
    .filter((m) => !m.match.live && !played(m.match) && m.match.a && m.match.b)
    .slice(0, 4);
  const names = new Map(t.entrants.map((e) => [e.id, e.name]));
  // Once every match is played: the validated placements, else the tournament's ranking.
  const podium =
    t.status !== "done"
      ? []
      : (league.results?.placements.map((p) => p.name) ??
        t.ranking.map((id) => names.get(id) ?? ""));

  return (
    <div className="flex flex-col gap-8">
      {podium.length > 0 ? <Podium names={podium} /> : null}
      {live.length > 0 || next.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="live-now" className="flex min-w-0 flex-col gap-3">
            <h2 id="live-now" className="font-bold font-display text-2xl lg:text-4xl">
              En ce moment
            </h2>
            {live.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {live.map((m) => (
                  <BigMatch key={m.match.id} {...m} live />
                ))}
              </ul>
            ) : (
              <p className="text-lg text-muted-foreground lg:text-2xl">Pas de match lancé.</p>
            )}
          </section>
          <section aria-labelledby="live-next" className="flex min-w-0 flex-col gap-3">
            <h2 id="live-next" className="font-bold font-display text-2xl lg:text-4xl">
              À suivre
            </h2>
            {next.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {next.map((m) => (
                  <BigMatch key={m.match.id} {...m} live={false} />
                ))}
              </ul>
            ) : (
              <p className="text-lg text-muted-foreground lg:text-2xl">
                Tous les matchs prêts sont lancés.
              </p>
            )}
          </section>
        </div>
      ) : null}
      <section aria-label="Tableau du tournoi" className="lg:text-lg">
        <TournamentBoard tournament={t} />
      </section>
    </div>
  );
}
