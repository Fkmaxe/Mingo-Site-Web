"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MatchCard } from "./match-card";
import type { Tournament } from "./types";

function PoolTable({ pool }: { pool: Tournament["pools"][number] }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Classement de la {pool.name}</caption>
      <thead className="text-muted-foreground text-xs">
        <tr>
          <th scope="col" className="w-6 py-1 text-left font-medium">
            #
          </th>
          <th scope="col" className="py-1 text-left font-medium">
            Nom
          </th>
          <th scope="col" className="w-7 py-1 text-right font-medium" title="Matchs joués">
            J
          </th>
          <th
            scope="col"
            className="w-12 py-1 text-right font-medium"
            title="Victoires, nuls, défaites"
          >
            V-N-D
          </th>
          <th scope="col" className="w-9 py-1 text-right font-medium" title="Différence de score">
            +/-
          </th>
          <th scope="col" className="w-9 py-1 text-right font-medium">
            Pts
          </th>
        </tr>
      </thead>
      <tbody>
        {pool.standings.map((s, i) => (
          <tr key={s.entrantId} className={cn("border-t", s.qualified && "bg-primary/6")}>
            <td className="py-2 font-semibold tabular-nums">{i + 1}</td>
            <td className="max-w-0 truncate py-2 font-medium">
              {s.name}
              {s.qualified ? <span className="sr-only"> (qualifié)</span> : null}
            </td>
            <td className="py-2 text-right tabular-nums">{s.played}</td>
            <td className="py-2 text-right text-muted-foreground tabular-nums">
              {s.won}-{s.drawn}-{s.lost}
            </td>
            <td className="py-2 text-right tabular-nums">{s.diff > 0 ? `+${s.diff}` : s.diff}</td>
            <td className="py-2 text-right font-bold tabular-nums">{s.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Pools({ tournament, manage }: { tournament: Tournament; manage: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {tournament.pools.map((pool) => (
        <section key={pool.index} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <h3 className="font-bold font-display">{pool.name}</h3>
          <PoolTable pool={pool} />
          <ul className="grid gap-2 sm:grid-cols-2">
            {pool.matches.map((m) => (
              <li key={m.id}>
                <MatchCard match={m} manage={manage} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {tournament.format === "pools_bracket" ? (
        <p className="text-muted-foreground text-xs">
          En surligné : qualifiés pour la phase finale. Victoire 3 pts, nul 1, défaite 0 ; à
          égalité, différence de score puis confrontation directe.
        </p>
      ) : null}
    </div>
  );
}

/** Knockout rounds in columns, scrolled sideways on a phone. */
function Bracket({ tournament, manage }: { tournament: Tournament; manage: boolean }) {
  const last = tournament.rounds.length - 1;
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <ol className="flex min-w-max gap-3">
        {tournament.rounds.map((round, i) => (
          <li key={round.round} className="flex w-56 shrink-0 flex-col gap-2">
            <h3 className="font-bold font-display text-sm">{round.name}</h3>
            <ul className="flex flex-1 flex-col justify-around gap-3">
              {round.matches.map((m) => (
                <li key={m.id}>
                  <MatchCard match={m} manage={manage} />
                </li>
              ))}
            </ul>
            {i === last && tournament.thirdPlaceMatch ? (
              <div className="flex flex-col gap-2 pt-4">
                <h3 className="font-bold font-display text-sm">Petite finale</h3>
                <MatchCard match={tournament.thirdPlaceMatch} manage={manage} />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Pools and bracket of a tournament: read-only, or with results entry for organisers. */
export function TournamentBoard({
  tournament,
  manage = false,
}: {
  tournament: Tournament;
  manage?: boolean;
}) {
  const hasPools = tournament.pools.length > 0;
  const hasBracket = tournament.rounds.length > 0;
  const [tab, setTab] = useState<"pools" | "bracket">(hasBracket ? "bracket" : "pools");
  if (hasPools && hasBracket) {
    return (
      <div className="flex flex-col gap-4">
        <div
          role="tablist"
          aria-label="Phase du tournoi"
          className="grid grid-cols-2 rounded-full bg-muted p-1 text-sm"
        >
          {(
            [
              ["pools", "Poules"],
              ["bracket", "Phase finale"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "min-h-11 rounded-full font-semibold",
                tab === value ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "pools" ? (
          <Pools tournament={tournament} manage={manage} />
        ) : (
          <Bracket tournament={tournament} manage={manage} />
        )}
      </div>
    );
  }
  return hasBracket ? (
    <Bracket tournament={tournament} manage={manage} />
  ) : (
    <Pools tournament={tournament} manage={manage} />
  );
}
