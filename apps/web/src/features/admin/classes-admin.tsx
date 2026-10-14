"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLevelAction, createTrackAction, editLevelAction, editTrackAction } from "./actions";
import { useAction } from "./use-action";

type Entry = {
  id: string;
  name: string;
  code: string | null;
  userCount: number;
  position?: number;
};
type LevelEntry = Entry & { position: number; alternanceOnly: boolean; trackIds: string[] };

/** Name and short code (used in the class code: "4" + "AL" + number = 4AL1). */
function EntryRow({
  entry,
  onSave,
  move,
}: {
  entry: Entry;
  onSave: (name: string, code: string | null) => void;
  move?: { up: (() => void) | null; down: (() => void) | null };
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.name);
  const [code, setCode] = useState(entry.code ?? "");
  return (
    <div className="flex min-h-14 items-center gap-2 px-4 py-2">
      {editing ? (
        <>
          <Input
            value={name}
            maxLength={40}
            autoFocus
            aria-label="Nom"
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            value={code}
            maxLength={6}
            aria-label="Code"
            placeholder="Code"
            className="w-20 shrink-0 font-mono uppercase"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
          <Button
            size="icon"
            aria-label="Enregistrer"
            disabled={name.trim().length === 0}
            onClick={() => {
              onSave(name.trim(), code || null);
              setEditing(false);
            }}
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
        </>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold">
              {entry.name}
              {entry.code ? (
                <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
                  {entry.code}
                </span>
              ) : null}
            </span>
            <span className="text-muted-foreground text-xs">
              {entry.userCount} étudiant{entry.userCount > 1 ? "s" : ""}
            </span>
          </span>
          {move ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Monter"
                disabled={!move.up}
                onClick={move.up ?? undefined}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Descendre"
                disabled={!move.down}
                onClick={move.down ?? undefined}
              >
                <ArrowDown aria-hidden />
              </Button>
            </>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Modifier ${entry.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
          </Button>
        </>
      )}
    </div>
  );
}

/** Work-study only or not, and the programmes offered in this year (none checked = all). */
function LevelRules({ level, tracks }: { level: LevelEntry; tracks: Entry[] }) {
  const { run, pending, error } = useAction();
  const [alternanceOnly, setAlternanceOnly] = useState(level.alternanceOnly);
  const [trackIds, setTrackIds] = useState(level.trackIds);
  const changed =
    alternanceOnly !== level.alternanceOnly ||
    [...trackIds].sort().join() !== [...level.trackIds].sort().join();
  const summary = [
    level.alternanceOnly ? "Alternance obligatoire" : "Initial ou alternance",
    level.trackIds.length === 0
      ? "toutes les filières"
      : tracks
          .filter((t) => level.trackIds.includes(t.id))
          .map((t) => t.name)
          .join(", "),
  ].join(" · ");
  return (
    <details className="px-4 pb-3">
      <summary className="min-h-9 cursor-pointer content-center text-muted-foreground text-xs">
        {summary}
      </summary>
      <div className="flex flex-col gap-3 pt-2">
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={alternanceOnly}
            onChange={(e) => setAlternanceOnly(e.target.checked)}
            className="size-5 accent-primary"
          />
          Alternance obligatoire
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium text-sm">Filières proposées</legend>
          {tracks.map((t) => (
            <label key={t.id} className="flex min-h-10 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={trackIds.includes(t.id)}
                onChange={(e) =>
                  setTrackIds((ids) =>
                    e.target.checked ? [...ids, t.id] : ids.filter((id) => id !== t.id),
                  )
                }
                className="size-5 accent-primary"
              />
              {t.name}
            </label>
          ))}
          <p className="text-muted-foreground text-xs">Aucune cochée : toutes les filières.</p>
        </fieldset>
        <Button
          size="sm"
          className="self-start"
          disabled={pending || !changed}
          onClick={() =>
            run(() => editLevelAction(level.id, { name: level.name, alternanceOnly, trackIds }))
          }
        >
          Enregistrer
        </Button>
      </div>
    </details>
  );
}

function AddForm({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onAdd(name.trim());
        setName("");
      }}
    >
      <Input
        value={name}
        maxLength={40}
        placeholder={placeholder}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" disabled={name.trim().length === 0}>
        <Plus aria-hidden />
        Ajouter
      </Button>
    </form>
  );
}

/** Years of study (ordered) and programmes; students pick theirs in their profile. */
export function ClassesAdmin({ levels, tracks }: { levels: LevelEntry[]; tracks: Entry[] }) {
  const { run, error } = useAction();
  const swap = (a: Entry, b: Entry) =>
    run(async () => {
      const first = await editLevelAction(a.id, { name: a.name, position: b.position ?? 0 });
      if (!first.ok) return first;
      return editLevelAction(b.id, { name: b.name, position: a.position ?? 0 });
    });
  return (
    <div className="flex flex-col gap-6">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold font-display text-lg">Années</h2>
        {levels.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-primary/5 shadow-sm">
            {levels.map((l, i) => {
              const prev = levels[i - 1];
              const next = levels[i + 1];
              return (
                <li key={l.id}>
                  <EntryRow
                    entry={l}
                    onSave={(name, code) => run(() => editLevelAction(l.id, { name, code }))}
                    move={{
                      up: prev ? () => swap(l, prev) : null,
                      down: next ? () => swap(l, next) : null,
                    }}
                  />
                  <LevelRules
                    key={`${l.alternanceOnly}-${l.trackIds.join()}`}
                    level={l}
                    tracks={tracks}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
        <AddForm
          placeholder="1A, 2A… ou B1, M2…"
          onAdd={(name) => run(() => createLevelAction(name))}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-bold font-display text-lg">Filières</h2>
        {tracks.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-primary/5 shadow-sm">
            {tracks.map((t) => (
              <li key={t.id}>
                <EntryRow
                  entry={t}
                  onSave={(name, code) => run(() => editTrackAction(t.id, { name, code }))}
                />
              </li>
            ))}
          </ul>
        ) : null}
        <AddForm
          placeholder="Réseaux, Sécurité, MCSI…"
          onAdd={(name) => run(() => createTrackAction(name))}
        />
      </section>
      <p className="text-muted-foreground text-xs">
        Renommer une année ou une filière, ou changer son code, met à jour la classe affichée de
        tous les étudiants concernés. Le code de classe ESGI assemble le code de l'année, celui de
        la filière (ou A / I selon le rythme si elle n'en a pas) et le numéro : 4AL1, 1A3, 2I8. Une
        année en alternance obligatoire passe tous ses étudiants en alternance.
      </p>
    </div>
  );
}
