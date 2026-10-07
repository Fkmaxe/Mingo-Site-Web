"use client";

import { CreateStaffSlotInput } from "@bde/shared";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { parisInputToIso } from "@/lib/paris-time";
import { createSlotAction, decideAssignmentAction, deleteSlotAction } from "./actions";
import { slotTime } from "./slot-time";
import type { StaffSlot } from "./types";

const STATUS_LABELS = { proposed: "Proposé", validated: "Validé", declined: "Refusé" } as const;

/** Organiser view: create slots, decide on proposals, mark staff present. */
export function StaffManager({ eventId, slots }: { eventId: string; slots: StaffSlot[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", startsAt: "", endsAt: "", capacity: "2" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? null : result.message);
      if (!result.ok) setErrors(result.fieldErrors);
      router.refresh();
    });

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CreateStaffSlotInput.safeParse({
      label: form.label,
      startsAt: parisInputToIso(form.startsAt) ?? "",
      endsAt: parisInputToIso(form.endsAt) ?? "",
      capacity: Number(form.capacity),
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    run(async () => {
      const result = await createSlotAction(eventId, parsed.data);
      if (result.ok) setForm({ label: "", startsAt: "", endsAt: "", capacity: "2" });
      return result;
    });
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="flex flex-col gap-4">
      {message ? <FormAlert tone="error">{message}</FormAlert> : null}
      {slots.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun créneau staff pour l'instant.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {slots.map((slot) => (
            <li key={slot.id} className="flex flex-col gap-2 rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-medium">{slot.label}</span>
                  <span className="text-muted-foreground text-xs first-letter:uppercase">
                    {slotTime(slot)} · {slot.validatedCount}/{slot.capacity} validé·e·s
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Supprimer le créneau ${slot.label}`}
                  disabled={pending}
                  onClick={() => run(() => deleteSlotAction(slot.id))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              {slot.assignments.length === 0 ? (
                <p className="text-muted-foreground text-xs">Personne ne s'est proposé.</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {slot.assignments.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm">{a.user.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {STATUS_LABELS[a.status]}
                          {a.pole ? ` · ${a.pole}` : ""}
                          {a.checkedInAt ? " · présent·e" : ""}
                        </span>
                      </span>
                      <span className="flex gap-1">
                        {a.status !== "validated" ? (
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() => run(() => decideAssignmentAction(a.id, "validate"))}
                          >
                            Valider
                          </Button>
                        ) : null}
                        {a.status === "proposed" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => run(() => decideAssignmentAction(a.id, "decline"))}
                          >
                            Refuser
                          </Button>
                        ) : null}
                        {a.status === "validated" && !a.checkedInAt ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => run(() => decideAssignmentAction(a.id, "checkin"))}
                          >
                            Présent
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={create}
        noValidate
        className="flex flex-col gap-3 rounded-xl border border-dashed p-3"
      >
        <span className="font-medium text-sm">Nouveau créneau</span>
        <FormField
          id="slot-label"
          label="Nom"
          placeholder="Accueil, bar, rangement…"
          value={form.label}
          onChange={set("label")}
          error={errors.label}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            id="slot-start"
            label="Début"
            type="datetime-local"
            value={form.startsAt}
            onChange={set("startsAt")}
            error={errors.startsAt}
          />
          <FormField
            id="slot-end"
            label="Fin"
            type="datetime-local"
            value={form.endsAt}
            onChange={set("endsAt")}
            error={errors.endsAt}
          />
        </div>
        <FormField
          id="slot-capacity"
          label="Places"
          type="number"
          inputMode="numeric"
          min={1}
          value={form.capacity}
          onChange={set("capacity")}
          error={errors.capacity}
        />
        <Button type="submit" variant="outline" disabled={pending}>
          Ajouter le créneau
        </Button>
      </form>
    </div>
  );
}
