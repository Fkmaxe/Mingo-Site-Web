"use client";

import {
  Archive,
  ArrowRightLeft,
  Camera,
  LogIn,
  LogOut,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { FieldShell, FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { formatDateTime, parisInputToIso } from "@/lib/paris-time";
import {
  adjustAction,
  archiveAction,
  checkoutAction,
  editItemAction,
  removePhotoAction,
  restoreAction,
  returnAction,
  uploadPhotoAction,
} from "./actions";
import { CategoryPicker, ConditionPicker, LocationPicker, PhotoPicker } from "./pickers";
import type { Item, ItemCondition } from "./types";

type Panel = "move" | "condition" | "checkout" | "stock" | "photo" | "edit" | "archive" | null;

type Props = {
  item: Item;
  locations: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  poles: { id: string; name: string }[];
  events: { id: string; title: string }[];
  myName: string;
  canArchive: boolean;
};

function NoteField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FormField
      id={id}
      label="Note (facultatif)"
      value={value}
      maxLength={500}
      placeholder="Pourquoi, pour qui…"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function ItemActions({
  item,
  locations,
  categories,
  poles,
  events,
  myName,
  canArchive,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const archived = item.archivedAt !== null;
  const unique = item.kind === "unique";

  const open = (next: Panel) => {
    setError(null);
    setNote("");
    setPanel(panel === next ? null : next);
  };
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) return setError(result.message);
      setPanel(null);
      setNote("");
      router.refresh();
    });

  // Panel states.
  const [locationId, setLocationId] = useState(item.location?.id ?? "");
  const [condition, setCondition] = useState<ItemCondition>(item.condition);
  const [holder, setHolder] = useState(myName);
  const [outQuantity, setOutQuantity] = useState("1");
  const [eventId, setEventId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [delta, setDelta] = useState(1);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [name, setName] = useState(item.name);
  const [categoryId, setCategoryId] = useState(item.category?.id ?? "");
  const [description, setDescription] = useState(item.description);
  const [poleId, setPoleId] = useState(item.pole?.id ?? "");
  const [returning, setReturning] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState<ItemCondition>(item.condition);

  if (archived) {
    return (
      <div className="flex flex-col gap-3">
        <FormAlert tone="error">
          Cet objet est archivé : il n'apparaît plus dans l'inventaire.
        </FormAlert>
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        {canArchive ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => restoreAction(item.id))}
          >
            <RotateCcw aria-hidden />
            Restaurer
          </Button>
        ) : null}
      </div>
    );
  }

  const tile = (id: Exclude<Panel, null>, label: string, icon: ReactNode, show = true) =>
    show ? (
      <button
        type="button"
        aria-expanded={panel === id}
        onClick={() => open(id)}
        className={
          panel === id
            ? "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-primary font-semibold text-primary-foreground text-xs"
            : "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border bg-card font-semibold text-xs hover:bg-accent"
        }
      >
        {icon}
        {label}
      </button>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {item.checkouts.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold font-display">Sorti</h2>
          <ul className="flex flex-col gap-2">
            {item.checkouts.map((c) => (
              <li
                key={c.id}
                className={
                  c.overdue
                    ? "flex flex-col gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3"
                    : "flex flex-col gap-2 rounded-2xl border bg-card p-3"
                }
              >
                <div className="flex flex-col text-sm">
                  <span className="font-semibold">
                    {c.quantity > 1 ? `${c.quantity} × ` : ""}chez {c.holder}
                  </span>
                  {c.event ? (
                    <span className="text-muted-foreground text-xs">Pour {c.event.title}</span>
                  ) : null}
                  <span className="text-muted-foreground text-xs">
                    Depuis le {formatDateTime(c.outAt)}
                    {c.outBy ? ` (${c.outBy.name})` : ""}
                  </span>
                  {c.dueAt ? (
                    <span
                      className={c.overdue ? "font-semibold text-destructive text-xs" : "text-xs"}
                    >
                      {c.overdue ? "En retard : " : "Retour prévu "}
                      {formatDateTime(c.dueAt)}
                    </span>
                  ) : null}
                  {c.note ? <span className="text-xs italic">« {c.note} »</span> : null}
                </div>
                {returning === c.id ? (
                  <div className="flex flex-col gap-3">
                    <ConditionPicker
                      name={`return-${c.id}`}
                      value={returnCondition}
                      onChange={setReturnCondition}
                    />
                    <NoteField id={`return-note-${c.id}`} value={note} onChange={setNote} />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={pending}
                        onClick={() =>
                          run(() => returnAction(item.id, c.id, returnCondition, note))
                        }
                      >
                        Confirmer le retour
                      </Button>
                      <Button variant="outline" onClick={() => setReturning(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => setReturning(c.id)}
                  >
                    <LogIn aria-hidden />
                    Rendre
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {tile("move", "Déplacer", <ArrowRightLeft aria-hidden className="size-5" />)}
        {tile("condition", "État", <Wrench aria-hidden className="size-5" />)}
        {tile("checkout", "Sortir", <LogOut aria-hidden className="size-5" />, item.available > 0)}
        {tile("stock", "Stock ±", <Plus aria-hidden className="size-5" />, !unique)}
        {tile("photo", "Photo", <Camera aria-hidden className="size-5" />)}
        {tile("edit", "Modifier", <Pencil aria-hidden className="size-5" />)}
        {tile("archive", "Archiver", <Archive aria-hidden className="size-5" />, canArchive)}
      </div>

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      {panel ? (
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm">
          {panel === "move" ? (
            <>
              <LocationPicker
                id="move-location"
                locations={locations}
                value={locationId}
                onChange={setLocationId}
              />
              <NoteField id="move-note" value={note} onChange={setNote} />
              <Button
                disabled={pending || locationId === (item.location?.id ?? "")}
                onClick={() =>
                  run(() => editItemAction(item.id, { locationId: locationId || null, note }))
                }
              >
                Déplacer
              </Button>
            </>
          ) : null}

          {panel === "condition" ? (
            <>
              <ConditionPicker value={condition} onChange={setCondition} />
              <NoteField id="condition-note" value={note} onChange={setNote} />
              <Button
                disabled={pending || condition === item.condition}
                onClick={() => run(() => editItemAction(item.id, { condition, note }))}
              >
                Enregistrer l'état
              </Button>
            </>
          ) : null}

          {panel === "checkout" ? (
            <>
              <FormField
                id="checkout-holder"
                label="Qui l'a ?"
                value={holder}
                maxLength={120}
                onChange={(e) => setHolder(e.target.value)}
              />
              {unique ? null : (
                <FormField
                  id="checkout-quantity"
                  label={`Quantité (${item.available} disponibles)`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={item.available}
                  value={outQuantity}
                  onChange={(e) => setOutQuantity(e.target.value)}
                />
              )}
              <FieldShell id="checkout-event" label="Pour un événement (facultatif)">
                {(aria) => (
                  <NativeSelect
                    {...aria}
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                  >
                    <option value="">Aucun</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FieldShell>
              <FormField
                id="checkout-due"
                label="Retour prévu (facultatif)"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
              <NoteField id="checkout-note" value={note} onChange={setNote} />
              <Button
                disabled={pending || holder.trim().length < 2}
                onClick={() =>
                  run(() =>
                    checkoutAction(item.id, {
                      quantity: unique ? 1 : Number(outQuantity),
                      holder: holder.trim(),
                      eventId: eventId || null,
                      dueAt: dueAt ? parisInputToIso(dueAt) : null,
                      note,
                    }),
                  )
                }
              >
                Sortir
              </Button>
            </>
          ) : null}

          {panel === "stock" ? (
            <>
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Moins"
                  onClick={() => setDelta((d) => d - 1)}
                >
                  <Minus aria-hidden />
                </Button>
                <span className="min-w-20 text-center font-display font-extrabold text-3xl tabular-nums">
                  {delta > 0 ? `+${delta}` : delta}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Plus"
                  onClick={() => setDelta((d) => d + 1)}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
              <p className="text-center text-muted-foreground text-sm">
                {item.quantity} → {Math.max(item.quantity + delta, 0)}
              </p>
              <NoteField id="stock-note" value={note} onChange={setNote} />
              <Button
                disabled={pending || delta === 0}
                onClick={() => run(() => adjustAction(item.id, delta, note))}
              >
                Ajuster le stock
              </Button>
            </>
          ) : null}

          {panel === "photo" ? (
            <>
              <PhotoPicker photo={photo} onChange={setPhoto} />
              <Button
                disabled={pending || !photo}
                onClick={() =>
                  run(() => {
                    const form = new FormData();
                    if (photo) form.set("photo", photo, "photo.jpg");
                    return uploadPhotoAction(item.id, form);
                  })
                }
              >
                {item.photoUrl ? "Remplacer la photo" : "Enregistrer la photo"}
              </Button>
              {item.photoUrl ? (
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => removePhotoAction(item.id))}
                >
                  Retirer la photo actuelle
                </Button>
              ) : null}
            </>
          ) : null}

          {panel === "edit" ? (
            <>
              <FormField
                id="edit-name"
                label="Nom"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
              <CategoryPicker
                id="edit-category"
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
              />
              <FieldShell id="edit-pole" label="Pôle">
                {(aria) => (
                  <NativeSelect
                    {...aria}
                    value={poleId}
                    onChange={(e) => setPoleId(e.target.value)}
                  >
                    <option value="">Tout le BDE</option>
                    {poles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FieldShell>
              <FieldShell id="edit-description" label="Description">
                {(aria) => (
                  <Textarea
                    {...aria}
                    rows={3}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                )}
              </FieldShell>
              <Button
                disabled={pending || name.trim().length === 0}
                onClick={() =>
                  run(() =>
                    editItemAction(item.id, {
                      name: name.trim(),
                      categoryId: categoryId || null,
                      description: description.trim(),
                      poleId: poleId || null,
                    }),
                  )
                }
              >
                Enregistrer
              </Button>
            </>
          ) : null}

          {panel === "archive" ? (
            <>
              <p className="text-sm">
                L'objet disparaît de l'inventaire (perdu, jeté, vendu…). Son historique est gardé et
                il peut être restauré.
              </p>
              <NoteField id="archive-note" value={note} onChange={setNote} />
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => run(() => archiveAction(item.id, note))}
              >
                Archiver
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
