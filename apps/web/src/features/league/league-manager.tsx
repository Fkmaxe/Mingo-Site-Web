"use client";

import { Trophy } from "lucide-react";
import { useState } from "react";
import { FieldShell, FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/features/admin/use-action";
import { cn } from "@/lib/utils";
import {
  createTournamentAction,
  deleteTournamentAction,
  drawBracketAction,
  setLeagueSportAction,
  validateResultsAction,
} from "./actions";
import { TournamentBoard } from "./tournament-board";
import type { EventLeague, Tournament } from "./types";

type Sport = { id: string; name: string };
type Placement = { place: number; userId?: string; teamId?: string };

const FORMATS = [
  ["pools_bracket", "Poules + arbre", "Chacun contre chacun en poule, puis élimination directe."],
  ["bracket", "Arbre seul", "Élimination directe dès le premier match."],
  ["pools", "Poules seules", "Chacun contre chacun, classement aux points."],
] as const;

function SportPicker({
  eventId,
  league,
  sports,
}: {
  eventId: string;
  league: EventLeague;
  sports: Sport[];
}) {
  const { run, pending, error } = useAction();
  return (
    <div className="flex flex-col gap-2">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <FieldShell
        id="league-sport"
        label="Compte pour la ligue"
        hint="1 point à chaque participant pointé, plus le bonus du Top 5. Pas pour les inter-écoles."
      >
        {(aria) => (
          <NativeSelect
            {...aria}
            disabled={pending}
            value={league.sport?.id ?? ""}
            onChange={(e) => run(() => setLeagueSportAction(eventId, e.target.value || null))}
          >
            <option value="">Non, hors ligue</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                Oui : {s.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FieldShell>
    </div>
  );
}

function CreateTournament({ eventId, league }: { eventId: string; league: EventLeague }) {
  const { run, pending, error } = useAction();
  const [format, setFormat] = useState<(typeof FORMATS)[number][0]>("pools_bracket");
  const [source, setSource] = useState<"checked_in" | "registered">("checked_in");
  const [poolCount, setPoolCount] = useState("2");
  const [qualifiers, setQualifiers] = useState("2");
  const [thirdPlace, setThirdPlace] = useState(true);
  const who = league.teamEvent ? "équipes" : "participants";
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          createTournamentAction(eventId, {
            format,
            source,
            poolCount: Number(poolCount) || 1,
            qualifiersPerPool: Number(qualifiers) || 1,
            thirdPlace,
          }),
        );
      }}
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium text-sm">Format</legend>
        {FORMATS.map(([value, label, hint]) => (
          <label
            key={value}
            className={cn(
              "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm",
              format === value && "border-primary bg-primary/6",
            )}
          >
            <input
              type="radio"
              name="format"
              value={value}
              checked={format === value}
              onChange={() => setFormat(value)}
              className="mt-1 size-4 accent-primary"
            />
            <span className="flex flex-col">
              <span className="font-semibold">{label}</span>
              <span className="text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <FieldShell id="tournament-source" label={`Qui joue`}>
        {(aria) => (
          <NativeSelect
            {...aria}
            value={source}
            onChange={(e) =>
              setSource(e.target.value === "registered" ? "registered" : "checked_in")
            }
          >
            <option value="checked_in">Les {who} pointés à l'entrée</option>
            <option value="registered">
              Tous les inscrits confirmés ({league.candidates.length})
            </option>
          </NativeSelect>
        )}
      </FieldShell>
      {format !== "bracket" ? (
        <div className="grid grid-cols-2 gap-3">
          <FieldShell id="pool-count" label="Poules">
            {(aria) => (
              <Input
                {...aria}
                inputMode="numeric"
                value={poolCount}
                onChange={(e) => setPoolCount(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
            )}
          </FieldShell>
          {format === "pools_bracket" ? (
            <FieldShell id="qualifiers" label="Qualifiés par poule">
              {(aria) => (
                <Input
                  {...aria}
                  inputMode="numeric"
                  value={qualifiers}
                  onChange={(e) => setQualifiers(e.target.value.replace(/\D/g, "").slice(0, 1))}
                />
              )}
            </FieldShell>
          ) : null}
        </div>
      ) : null}
      {format !== "pools" ? (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={thirdPlace}
            onChange={(e) => setThirdPlace(e.target.checked)}
            className="size-5 accent-primary"
          />
          Petite finale pour la 3e place
        </label>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Tirage…" : "Créer le tournoi et tirer au sort"}
      </Button>
    </form>
  );
}

function TournamentControls({ eventId, tournament }: { eventId: string; tournament: Tournament }) {
  const { run, pending, error } = useAction();
  const [confirming, setConfirming] = useState(false);
  const poolsDone = tournament.pools.every((p) => p.matches.every((m) => m.winnerId || m.draw));
  return (
    <div className="flex flex-col gap-2">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {tournament.format === "pools_bracket" && tournament.status === "pools" ? (
        <Button
          size="lg"
          disabled={pending || !poolsDone}
          onClick={() => run(() => drawBracketAction(eventId))}
        >
          {poolsDone
            ? "Tirer l'arbre de la phase finale"
            : "Arbre : saisis d'abord tous les matchs de poule"}
        </Button>
      ) : null}
      {confirming ? (
        <div className="flex gap-2">
          <Button
            variant="destructive"
            className="flex-1"
            disabled={pending}
            onClick={() =>
              run(
                () => deleteTournamentAction(eventId),
                () => setConfirming(false),
              )
            }
          >
            Supprimer poules, arbre et résultats des matchs
          </Button>
          <Button variant="outline" onClick={() => setConfirming(false)}>
            Retour
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          className="self-start text-destructive"
          onClick={() => setConfirming(true)}
        >
          Recommencer le tournoi
        </Button>
      )}
    </div>
  );
}

const keyOf = (c: { userId: string | null; teamId: string | null }) =>
  c.userId ? `u:${c.userId}` : c.teamId ? `t:${c.teamId}` : "";

/** Placements prefilled from the validated results, or else from the tournament ranking. */
function initialPlaces(league: EventLeague): string[] {
  const places = Array.from({ length: league.rewardedPlaces }, () => "");
  if (league.results) {
    for (const p of league.results.placements)
      if (p.place <= places.length) places[p.place - 1] = keyOf(p);
    return places;
  }
  const t = league.tournament;
  if (!t) return places;
  const entrant = new Map(t.entrants.map((e) => [e.id, e]));
  t.ranking.slice(0, places.length).forEach((id, i) => {
    const e = entrant.get(id);
    if (e) places[i] = keyOf(e);
  });
  return places;
}

function ResultsForm({ eventId, league }: { eventId: string; league: EventLeague }) {
  const { run, pending, error } = useAction();
  const [places, setPlaces] = useState(() => initialPlaces(league));
  const chosen = places.filter(Boolean);
  const duplicate = new Set(chosen).size !== chosen.length;
  const unfinished = league.tournament && league.tournament.status !== "done";
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const placements = places.flatMap((key, i): Placement[] => {
          if (key.startsWith("u:")) return [{ place: i + 1, userId: key.slice(2) }];
          if (key.startsWith("t:")) return [{ place: i + 1, teamId: key.slice(2) }];
          return [];
        });
        run(() => validateResultsAction(eventId, placements));
      }}
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {league.results ? (
        <FormAlert tone="success">Classement validé : les points de ligue sont comptés.</FormAlert>
      ) : null}
      {unfinished ? (
        <p className="text-muted-foreground text-sm">
          Proposé d'après les matchs joués. Le tournoi n'est pas fini : vérifie avant de valider.
        </p>
      ) : null}
      <ol className="flex flex-col gap-2">
        {places.map((value, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a place is its index.
          <li key={i} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full font-bold text-sm",
                i === 0 ? "bg-brand-pink text-brand-pink-foreground" : "bg-muted",
              )}
            >
              {i + 1}
            </span>
            <NativeSelect
              aria-label={`${i + 1}${i === 0 ? "re" : "e"} place`}
              value={value}
              onChange={(e) => setPlaces((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
            >
              <option value="">—</option>
              {league.candidates.map((c) => (
                <option key={keyOf(c)} value={keyOf(c)}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </li>
        ))}
      </ol>
      {duplicate ? (
        <FormAlert tone="error">Chaque participant ne peut avoir qu'une place.</FormAlert>
      ) : null}
      <Button type="submit" size="lg" disabled={pending || duplicate}>
        <Trophy aria-hidden />
        {league.results ? "Corriger le classement" : "Valider le classement"}
      </Button>
      <p className="text-muted-foreground text-xs">
        Les points sont écrits dans le journal de la ligue ; une correction annule puis remplace
        ceux de cet événement.
      </p>
    </form>
  );
}

/** "Ligue & tournoi" section of the event's management page. */
export function LeagueManager({ eventId, league }: { eventId: string; league: EventLeague }) {
  return (
    <div className="flex flex-col gap-5">
      <SportPicker eventId={eventId} league={league} sports={league.sports} />
      {league.tournament ? (
        <>
          <TournamentBoard tournament={league.tournament} manage />
          <TournamentControls eventId={eventId} tournament={league.tournament} />
        </>
      ) : (
        <details className="rounded-2xl border bg-card p-4 [&[open]>summary]:mb-4">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">
            Organiser un tournoi (poules, arbre)
          </summary>
          <CreateTournament eventId={eventId} league={league} />
        </details>
      )}
      {league.sport ? (
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <h3 className="font-bold font-display">Classement de l'événement</h3>
          {league.candidates.length === 0 ? (
            <p className="text-muted-foreground text-sm">Personne n'est encore inscrit.</p>
          ) : (
            <ResultsForm
              key={JSON.stringify([league.results, league.tournament?.ranking])}
              eventId={eventId}
              league={league}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
