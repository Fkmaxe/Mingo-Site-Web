"use client";

import { CreateEventInput, EVENT_VISIBILITIES } from "@bde/shared";
import { useState } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { FieldShell, FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { EVENT_VISIBILITY_LABELS } from "@/lib/labels";
import { createEventAction, updateEventAction } from "./actions";
import { type EventFormValues, eventFormResolver, formToInput } from "./event-form-values";
import type { Pole } from "./types";

type Props = {
  poles: Pole[];
  defaultValues: EventFormValues;
  /** Absent: creation. */
  eventId?: string;
};

export function EventForm({ poles, defaultValues, eventId }: Props) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({ defaultValues, resolver: eventFormResolver });

  const onSubmit = handleSubmit(async (values) => {
    setResult(null);
    // Already validated by the resolver: parsing applies defaults and narrows the types.
    const input = CreateEventInput.parse(formToInput(values));
    // The action redirects on creation; it only returns on error or after an update.
    const outcome = eventId
      ? await updateEventAction(eventId, input)
      : await createEventAction(input);
    setResult(outcome);
    if (!outcome.ok) {
      for (const [field, message] of Object.entries(outcome.fieldErrors)) {
        if (field in defaultValues) setError(field as FieldPath<EventFormValues>, { message });
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.ok ? <FormAlert tone="error">{result.message}</FormAlert> : null}
      {result?.ok ? <FormAlert tone="success">Modifications enregistrées.</FormAlert> : null}

      <FormField id="title" label="Titre" error={errors.title?.message} {...register("title")} />

      <FieldShell id="poleId" label="Pôle organisateur" error={errors.poleId?.message}>
        {(aria) => (
          <NativeSelect {...aria} {...register("poleId")}>
            <option value="">Choisir…</option>
            {poles.map((pole) => (
              <option key={pole.id} value={pole.id}>
                {pole.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FieldShell>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="startsAt"
          label="Début"
          type="datetime-local"
          error={errors.startsAt?.message}
          {...register("startsAt")}
        />
        <FormField
          id="endsAt"
          label="Fin"
          type="datetime-local"
          error={errors.endsAt?.message}
          {...register("endsAt")}
        />
      </div>

      <FormField
        id="location"
        label="Lieu"
        placeholder="ESGI Paris, salle B12"
        error={errors.location?.message}
        {...register("location")}
      />

      <FieldShell id="description" label="Description" error={errors.description?.message}>
        {(aria) => <Textarea {...aria} rows={5} {...register("description")} />}
      </FieldShell>

      <FieldShell
        id="visibility"
        label="Qui peut voir l'événement ?"
        error={errors.visibility?.message}
      >
        {(aria) => (
          <NativeSelect {...aria} {...register("visibility")}>
            {EVENT_VISIBILITIES.map((visibility) => (
              <option key={visibility} value={visibility}>
                {EVENT_VISIBILITY_LABELS[visibility]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FieldShell>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="capacity"
          label="Places"
          type="number"
          inputMode="numeric"
          min={1}
          hint="Vide : illimité"
          error={errors.capacity?.message}
          {...register("capacity")}
        />
        <FormField
          id="openPointsValue"
          label="Points open par participant"
          type="number"
          inputMode="numeric"
          min={0}
          error={errors.openPointsValue?.message}
          {...register("openPointsValue")}
        />
      </div>

      <FormField
        id="registrationDeadline"
        label="Date limite d'inscription"
        type="datetime-local"
        hint="Vide : inscriptions ouvertes jusqu'à la fin de l'événement"
        error={errors.registrationDeadline?.message}
        {...register("registrationDeadline")}
      />

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Enregistrement…" : eventId ? "Enregistrer" : "Créer le brouillon"}
      </Button>
    </form>
  );
}
