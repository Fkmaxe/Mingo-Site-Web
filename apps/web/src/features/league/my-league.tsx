import { ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatShortDay } from "@/lib/paris-time";
import type { MyLeague } from "./types";

const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);

function summary(league: MyLeague): string {
  if (league.rank === null)
    return "Pas encore de points : viens à un événement sportif de la ligue.";
  return `${ordinal(league.rank)} sur ${league.ranked} · ${league.points} pt${league.points > 1 ? "s" : ""}`;
}

/** Home page: rank and points, links to the standings. */
export function MyLeagueLink({ league }: { league: MyLeague }) {
  if (!league.seasonName) return null;
  return (
    <Link
      href="/ligue"
      className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-primary/5 shadow-sm transition-colors hover:bg-accent"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-pink text-brand-pink-foreground">
        <Trophy aria-hidden className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold font-display leading-tight">{league.seasonName}</span>
        <span className="text-muted-foreground text-sm">{summary(league)}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/** Profile: rank, points and the events that earned them. */
export function MyLeagueCard({ league }: { league: MyLeague }) {
  if (!league.seasonName) return null;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Ma ligue sportive</CardTitle>
          <CardDescription>{summary(league)}</CardDescription>
        </div>
        <Link
          href="/ligue"
          className="shrink-0 font-semibold text-primary text-sm underline-offset-4 hover:underline"
        >
          Classement
        </Link>
      </div>
      {league.events.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-xl border">
          {league.events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.slug}`}
                className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-accent"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{e.title}</span>
                  <span className="text-muted-foreground text-xs first-letter:uppercase">
                    {formatShortDay(e.startsAt)}
                    {e.place ? ` · ${ordinal(e.place)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-bold text-primary tabular-nums">+{e.points}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
