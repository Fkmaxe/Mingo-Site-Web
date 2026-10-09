"use client";

import { Camera, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { FieldShell } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { createLocationAction } from "./actions";
import { CONDITION_LABELS } from "./labels";
import { resizePhoto } from "./resize-photo";
import type { ItemCondition } from "./types";

const CONDITIONS = Object.keys(CONDITION_LABELS) as ItemCondition[];

/** One tap per state: big chips instead of a select. */
export function ConditionPicker({
  value,
  onChange,
  name = "condition",
}: {
  value: ItemCondition;
  onChange: (value: ItemCondition) => void;
  name?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-sm">État</legend>
      <div className="flex flex-wrap gap-2">
        {CONDITIONS.map((c) => (
          <label
            key={c}
            className={cn(
              "flex min-h-10 cursor-pointer items-center rounded-full border px-3 font-semibold text-sm",
              value === c ? "border-primary bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            <input
              type="radio"
              name={name}
              value={c}
              checked={value === c}
              onChange={() => onChange(c)}
              className="sr-only"
            />
            {CONDITION_LABELS[c]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Location select, with a new location created on the spot. */
export function LocationPicker({
  id,
  locations: initial,
  value,
  onChange,
}: {
  id: string;
  locations: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [locations, setLocations] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setError(null);
      const result = await createLocationAction(name.trim());
      if (!result.ok) return setError(result.message);
      const list = result.locations ?? locations;
      setLocations(list);
      const created = list.find((l) => l.name.toLowerCase() === name.trim().toLowerCase());
      if (created) onChange(created.id);
      setName("");
      setAdding(false);
    });

  return (
    <FieldShell id={id} label="Lieu de rangement" error={error ?? undefined}>
      {(aria) =>
        adding ? (
          <div className="flex gap-2">
            <Input
              {...aria}
              value={name}
              autoFocus
              placeholder="Local BDE, cave, salle B12…"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <Button type="button" disabled={pending || name.trim().length < 2} onClick={add}>
              Ajouter
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Annuler"
              onClick={() => setAdding(false)}
            >
              <X aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <NativeSelect {...aria} value={value} onChange={(e) => onChange(e.target.value)}>
              <option value="">Non renseigné</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Nouveau lieu"
              onClick={() => setAdding(true)}
            >
              <Plus aria-hidden />
            </Button>
          </div>
        )
      }
    </FieldShell>
  );
}

/** Takes a photo (phone camera) or picks one, resized before upload. */
export function PhotoPicker({
  photo,
  onChange,
}: {
  photo: Blob | null;
  onChange: (photo: Blob | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Photo de l'objet"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError(null);
          try {
            onChange(await resizePhoto(file));
          } catch {
            setError("Cette image ne peut pas être lue. Essaie une autre photo.");
          }
        }}
      />
      {preview ? (
        <div className="relative">
          {/* biome-ignore lint/performance/noImgElement: local preview (object URL). */}
          <img
            src={preview}
            alt="Aperçu avant envoi"
            className="aspect-video w-full rounded-2xl bg-muted object-cover"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="absolute top-2 right-2"
            aria-label="Retirer la photo"
            onClick={() => onChange(null)}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-muted/50 font-semibold text-muted-foreground text-sm hover:bg-muted"
        >
          <Camera aria-hidden className="size-8" />
          Prendre une photo
        </button>
      )}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
