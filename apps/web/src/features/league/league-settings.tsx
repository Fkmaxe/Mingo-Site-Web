"use client";

import { Check, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/features/admin/use-action";
import { createSportAction, editSportAction, saveSeasonAction } from "./actions";
import type { League } from "./types";

function SeasonForm({ season }: { season: League["season"] }) {
  const { run, pending, error } = useAction();
  const [name, setName] = useState(season.name);
  const [prizes, setPrizes] = useState(season.prizes);
  const [scale, setScale] = useState(season.placementPoints.join(", "));
  const [participation, setParticipation] = useState(String(season.participationPoints));
  const [saved, setSaved] = useState(false);
  const points = scale
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(Number);
  const scaleValid =
    points.length > 0 && points.length <= 10 && points.every((p) => Number.isInteger(p) && p >= 0);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        run(
          () =>
            saveSeasonAction({
              name: name.trim(),
              prizes: prizes.trim(),
              placementPoints: points,
              participationPoints: Number(participation) || 0,
            }),
          () => setSaved(true),
        );
      }}
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {saved ? <FormAlert tone="success">Réglages enregistrés.</FormAlert> : null}
      <FormField
        id="league-name"
        label="Nom"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="league-prizes">Lots (un par ligne)</Label>
        <Textarea
          id="league-prizes"
          rows={3}
          maxLength={500}
          placeholder={"1er : PS5\n2e : Switch 2\n3e : carte Amazon 100 €"}
          value={prizes}
          onChange={(e) => setPrizes(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <FormField
          id="league-scale"
          label="Points par place"
          hint="1er, 2e, 3e… séparés par des virgules"
          inputMode="numeric"
          value={scale}
          error={scaleValid ? undefined : "Jusqu'à 10 nombres entiers"}
          onChange={(e) => setScale(e.target.value)}
        />
        <FormField
          id="league-participation"
          label="Participation"
          inputMode="numeric"
          className="w-24"
          value={participation}
          onChange={(e) => setParticipation(e.target.value.replace(/\D/g, "").slice(0, 3))}
        />
      </div>
      <Button type="submit" disabled={pending || !scaleValid || name.trim().length < 2}>
        Enregistrer les réglages
      </Button>
    </form>
  );
}

function SportRow({ sport }: { sport: League["sports"][number] }) {
  const { run, pending, error } = useAction();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sport.name);
  return (
    <li className="flex min-h-14 flex-col justify-center gap-1 px-4 py-2">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            aria-label="Nom du sport"
            value={name}
            maxLength={40}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            size="icon"
            aria-label="Enregistrer"
            disabled={pending || name.trim().length < 2}
            onClick={() =>
              run(
                () => editSportAction(sport.id, name.trim()),
                () => setEditing(false),
              )
            }
          >
            <Check aria-hidden />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Annuler"
            onClick={() => setEditing(false)}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold">{sport.name}</span>
            <span className="text-muted-foreground text-xs">
              {sport.eventCount} événement{sport.eventCount > 1 ? "s" : ""}
            </span>
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Renommer ${sport.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

function AddSport() {
  const { run, pending, error } = useAction();
  const [name, setName] = useState("");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createSportAction(name.trim()),
          () => setName(""),
        );
      }}
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <div className="flex gap-2">
        <Input
          aria-label="Nouveau sport"
          placeholder="Nouveau sport"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Ajouter le sport"
          disabled={pending || name.trim().length < 2}
        >
          <Plus aria-hidden />
        </Button>
      </div>
    </form>
  );
}

/** For the board: season settings and the list of sports. */
export function LeagueSettings({ league }: { league: League }) {
  return (
    <div className="flex flex-col gap-5">
      <SeasonForm season={league.season} />
      <div className="flex flex-col gap-3">
        <h3 className="font-bold font-display">Sports</h3>
        <ul className="flex flex-col divide-y rounded-2xl border">
          {league.sports.map((s) => (
            <SportRow key={`${s.id}-${s.name}`} sport={s} />
          ))}
        </ul>
        <AddSport />
      </div>
    </div>
  );
}
