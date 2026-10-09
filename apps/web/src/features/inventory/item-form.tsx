"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FieldShell, FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createItemAction, uploadPhotoAction } from "./actions";
import { ConditionPicker, LocationPicker, PhotoPicker } from "./pickers";
import type { ItemCondition } from "./types";

type Props = {
  locations: { id: string; name: string }[];
  categories: string[];
  poles: { id: string; name: string }[];
};

/** Quick add: only the name is required. "Add another" keeps location, category and pole. */
export function ItemForm({ locations, categories, poles }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"unique" | "stock">("unique");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState<ItemCondition>("good");
  const [locationId, setLocationId] = useState("");
  const [category, setCategory] = useState("");
  const [poleId, setPoleId] = useState("");
  const [description, setDescription] = useState("");

  const submit = (another: boolean) =>
    startTransition(async () => {
      setError(null);
      setSaved(null);
      const result = await createItemAction({
        name: name.trim(),
        description: description.trim(),
        category: category.trim() || null,
        kind,
        quantity: kind === "stock" ? Number(quantity) : 1,
        condition,
        locationId: locationId || null,
        poleId: poleId || null,
      });
      if (!result.ok || !result.id) {
        setError(result.ok ? "Erreur inattendue." : result.message);
        return;
      }
      if (photo) {
        const form = new FormData();
        form.set("photo", photo, "photo.jpg");
        const uploaded = await uploadPhotoAction(result.id, form);
        if (!uploaded.ok) setError(`Objet ajouté, mais pas la photo : ${uploaded.message}`);
      }
      if (another) {
        setSaved(`« ${name.trim()} » ajouté.`);
        setName("");
        setPhoto(null);
        setDescription("");
        setQuantity("1");
        setCondition("good");
        return;
      }
      router.push(`/inventory/${result.id}`);
    });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {saved ? <FormAlert tone="success">{saved}</FormAlert> : null}
      <PhotoPicker photo={photo} onChange={setPhoto} />
      <FormField
        id="item-name"
        label="Nom"
        placeholder="Enceinte JBL, barnum 3×3, gobelets…"
        value={name}
        maxLength={120}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1 text-sm">
        {(
          [
            ["unique", "Objet unique"],
            ["stock", "Stock (quantité)"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
            className={cn(
              "min-h-10 rounded-full font-semibold",
              kind === value ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "stock" ? (
        <FormField
          id="item-quantity"
          label="Quantité"
          type="number"
          inputMode="numeric"
          min={0}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      ) : null}

      <ConditionPicker value={condition} onChange={setCondition} />
      <LocationPicker
        id="item-location"
        locations={locations}
        value={locationId}
        onChange={setLocationId}
      />

      <FieldShell id="item-category" label="Catégorie (facultatif)">
        {(aria) => (
          <>
            <input
              {...aria}
              list="item-categories"
              value={category}
              maxLength={60}
              placeholder="Son, déco, cuisine…"
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <datalist id="item-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        )}
      </FieldShell>

      <details className="flex flex-col gap-4">
        <summary className="cursor-pointer font-semibold text-primary text-sm">
          Plus de détails
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <FieldShell id="item-pole" label="Pôle (facultatif)">
            {(aria) => (
              <NativeSelect {...aria} value={poleId} onChange={(e) => setPoleId(e.target.value)}>
                <option value="">Tout le BDE</option>
                {poles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FieldShell>
          <FieldShell id="item-description" label="Description">
            {(aria) => (
              <Textarea
                {...aria}
                rows={3}
                maxLength={2000}
                value={description}
                placeholder="Marque, accessoires, où trouver la télécommande…"
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </FieldShell>
        </div>
      </details>

      <div className="sticky bottom-20 flex flex-col gap-2 rounded-2xl bg-background/90 py-2 backdrop-blur md:bottom-4">
        <Button type="submit" size="lg" disabled={pending || name.trim().length === 0}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={pending || name.trim().length === 0}
          onClick={() => submit(true)}
        >
          Enregistrer et en ajouter un autre
        </Button>
      </div>
    </form>
  );
}
