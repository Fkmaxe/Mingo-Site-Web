import { Gift, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandPanel, DisplayTitle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { LeagueSettings } from "@/features/league/league-settings";
import { getLeague } from "@/features/league/queries";
import { Podium, StandingsList } from "@/features/league/standings";
import { listClasses } from "@/features/profile/queries";
import { formatShortDay } from "@/lib/paris-time";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Ligue sportive" };

const ORDINAL = (n: number) => (n === 1 ? "1er" : `${n}e`);

export default async function LeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ niveau?: string; filiere?: string }>;
}) {
  const { niveau, filiere } = await searchParams;
  const filter = {
    ...(niveau ? { levelId: niveau } : {}),
    ...(filiere ? { trackId: filiere } : {}),
  };
  const [me, league, classes] = await Promise.all([requireMe(), getLeague(filter), listClasses()]);
  const filtered = Boolean(niveau || filiere);
  const mine = league.standings.find((s) => s.user.id === me.id);
  const { season } = league;
  const prizes = season.prizes.split("\n").filter((l) => l.trim());

  return (
    <div className="flex flex-col gap-6">
      <BrandPanel className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-white/90">
          <Trophy aria-hidden className="size-4" />
          Saison {season.schoolYear}
        </div>
        <DisplayTitle className="text-[1.75rem]">{season.name}</DisplayTitle>
        <p className="text-sm text-white/90">
          {mine
            ? `Tu es ${ORDINAL(mine.rank)}${filtered ? " de ta sélection" : ""} avec ${mine.points} point${mine.points > 1 ? "s" : ""}.`
            : "Viens à un événement sportif de la ligue pour marquer tes premiers points."}
        </p>
      </BrandPanel>

      {prizes.length > 0 ? (
        <Card>
          <CardTitle className="flex items-center gap-2">
            <Gift aria-hidden className="size-5 text-primary" />À gagner en fin d'année
          </CardTitle>
          <ul className="flex flex-col gap-1.5 text-sm">
            {prizes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-bold font-display text-lg">Classement général</h2>
        {classes.levels.length > 0 || classes.tracks.length > 0 ? (
          <form className="grid grid-cols-[1fr_1fr_auto] items-end gap-2" action="/ligue">
            <NativeSelect name="niveau" aria-label="Année" defaultValue={niveau ?? ""}>
              <option value="">Année</option>
              {classes.levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="filiere" aria-label="Filière" defaultValue={filiere ?? ""}>
              <option value="">Filière</option>
              {classes.tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" variant="outline">
              Filtrer
            </Button>
          </form>
        ) : null}
        {league.standings.length === 0 ? (
          <Card>
            <CardDescription>
              {filtered
                ? "Personne de cette classe n'a encore de points."
                : "Aucun point pour l'instant : le classement démarre au premier événement de la ligue."}
            </CardDescription>
          </Card>
        ) : (
          <>
            <Podium rows={league.standings.slice(0, 3)} />
            <StandingsList rows={league.standings} meId={me.id} />
          </>
        )}
      </section>

      <Card>
        <CardTitle>Comment marquer des points</CardTitle>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li>
            <strong>{season.participationPoints} point</strong> à chaque événement de la ligue où tu
            es pointé à l'entrée.
          </li>
          <li>
            Bonus du classement :{" "}
            {season.placementPoints.map((p, i) => `${ORDINAL(i + 1)} +${p}`).join(", ")}.
          </li>
          <li>En équipe, chaque membre de l'équipe classée reçoit les points de la place.</li>
          <li>Les événements inter-écoles ne comptent pas.</li>
        </ul>
      </Card>

      {league.events.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-display text-lg">Résultats</h2>
          <ul className="flex flex-col gap-3">
            {league.events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.slug}`}
                  className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm transition-colors hover:bg-accent"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{e.title}</span>
                    <span className="shrink-0 text-muted-foreground text-xs first-letter:uppercase">
                      {formatShortDay(e.startsAt)}
                    </span>
                  </span>
                  <span className="text-primary text-sm">{e.sport}</span>
                  <span className="text-muted-foreground text-sm">
                    {e.podium.map((p) => `${ORDINAL(p.place)} ${p.name}`).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {league.canManage ? (
        <Card>
          <div className="flex flex-col gap-1">
            <CardTitle>Réglages de la ligue</CardTitle>
            <CardDescription>
              Visible par le bureau. Un événement compte pour la ligue quand son organisateur
              choisit son sport, depuis la gestion de l'événement.
            </CardDescription>
          </div>
          <LeagueSettings league={league} />
        </Card>
      ) : null}
    </div>
  );
}
