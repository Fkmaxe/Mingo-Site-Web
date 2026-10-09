"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { createPoleAction, editPoleAction } from "./actions";
import type { Pole } from "./types";
import { useAction } from "./use-action";

function PoleForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { name: string; description: string };
  submitLabel: string;
  onSubmit: (value: { name: string; description: string | null }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), description: description.trim() || null });
      }}
    >
      <FormField
        id={`pole-name-${initial.name || "new"}`}
        label="Nom du pôle"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
      />
      <FormField
        id={`pole-description-${initial.name || "new"}`}
        label="Description (facultatif)"
        value={description}
        maxLength={500}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={name.trim().length < 2}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function PoleRow({ pole }: { pole: Pole }) {
  const { run, error } = useAction();
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {editing ? (
        <PoleForm
          initial={{ name: pole.name, description: pole.description ?? "" }}
          submitLabel="Enregistrer"
          onCancel={() => setEditing(false)}
          onSubmit={(value) =>
            run(
              () => editPoleAction(pole.id, value),
              () => setEditing(false),
            )
          }
        />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold">{pole.name}</span>
            {pole.description ? (
              <span className="truncate text-muted-foreground text-xs">{pole.description}</span>
            ) : null}
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Modifier ${pole.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

export function PolesAdmin({ poles }: { poles: Pole[] }) {
  const { run, error } = useAction();
  const [key, setKey] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      {poles.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-primary/5 shadow-sm">
          {poles.map((p) => (
            <PoleRow key={p.id} pole={p} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Aucun pôle pour l'instant.</p>
      )}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm">
        <h2 className="font-bold font-display">Nouveau pôle</h2>
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        <PoleForm
          key={key}
          initial={{ name: "", description: "" }}
          submitLabel="Créer le pôle"
          onSubmit={(value) =>
            run(
              () => createPoleAction(value),
              () => setKey((k) => k + 1),
            )
          }
        />
      </section>
    </div>
  );
}
