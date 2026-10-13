"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLevelAction, createTrackAction, editLevelAction, editTrackAction } from "./actions";
import { useAction } from "./use-action";

type Entry = { id: string; name: string; userCount: number; position?: number };

function EntryRow({
  entry,
  onRename,
  move,
}: {
  entry: Entry;
  onRename: (name: string) => void;
  move?: { up: (() => void) | null; down: (() => void) | null };
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.name);
  return (
    <li className="flex min-h-14 items-center gap-2 px-4 py-2">
      {editing ? (
        <>
          <Input value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} />
          <Button
            size="icon"
            aria-label="Enregistrer"
            disabled={name.trim().length === 0}
            onClick={() => {
              onRename(name.trim());
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
            <span className="font-semibold">{entry.name}</span>
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
            aria-label={`Renommer ${entry.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
          </Button>
        </>
      )}
    </li>
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
export function ClassesAdmin({ levels, tracks }: { levels: Entry[]; tracks: Entry[] }) {
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
                <EntryRow
                  key={l.id}
                  entry={l}
                  onRename={(name) => run(() => editLevelAction(l.id, { name }))}
                  move={{
                    up: prev ? () => swap(l, prev) : null,
                    down: next ? () => swap(l, next) : null,
                  }}
                />
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
              <EntryRow
                key={t.id}
                entry={t}
                onRename={(name) => run(() => editTrackAction(t.id, name))}
              />
            ))}
          </ul>
        ) : null}
        <AddForm
          placeholder="Dev, Cyber, Data…"
          onAdd={(name) => run(() => createTrackAction(name))}
        />
      </section>
      <p className="text-muted-foreground text-xs">
        Renommer une année ou une filière met à jour la classe affichée de tous les étudiants
        concernés.
      </p>
    </div>
  );
}
