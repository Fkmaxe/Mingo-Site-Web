"use client";

import { useState, useTransition } from "react";
import { FieldShell, FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { isoToParisInput, parisInputToIso } from "@/lib/paris-time";
import { createMeetingAction, updateMeetingAction } from "./actions";
import type { Meeting } from "./types";

type Props =
  | { mode: "create"; poles: { id: string; name: string }[]; allowGeneral: boolean }
  | { mode: "edit"; meeting: Meeting };

/** Creation (pole + agenda) or edition (agenda, minutes…) of a meeting. */
export function MeetingForm(props: Props) {
  const initial = props.mode === "edit" ? props.meeting : null;
  const [values, setValues] = useState({
    poleId: props.mode === "create" ? (props.poles[0]?.id ?? "") : "",
    title: initial?.title ?? "",
    startsAt: initial ? isoToParisInput(initial.startsAt) : "",
    location: initial?.location ?? "",
    agenda: initial?.agenda ?? "",
    minutes: initial?.minutes ?? "",
  });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = result && !result.ok ? result.fieldErrors : {};

  const set =
    (key: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const startsAt = parisInputToIso(values.startsAt) ?? "";
    startTransition(async () => {
      setResult(
        props.mode === "create"
          ? await createMeetingAction({
              poleId: values.poleId || null,
              title: values.title,
              startsAt,
              location: values.location,
              agenda: values.agenda,
            })
          : await updateMeetingAction(props.meeting.id, {
              title: values.title,
              startsAt,
              location: values.location,
              agenda: values.agenda,
              minutes: values.minutes,
            }),
      );
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {result && !result.ok ? <FormAlert tone="error">{result.message}</FormAlert> : null}
      {result?.ok ? <FormAlert tone="success">Réunion enregistrée.</FormAlert> : null}
      {props.mode === "create" ? (
        <FieldShell id="meeting-pole" label="Pôle" error={errors.poleId}>
          {(aria) => (
            <NativeSelect {...aria} value={values.poleId} onChange={set("poleId")}>
              {props.poles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {props.allowGeneral ? <option value="">Réunion générale du BDE</option> : null}
            </NativeSelect>
          )}
        </FieldShell>
      ) : null}
      <FormField
        id="meeting-title"
        label="Titre"
        value={values.title}
        onChange={set("title")}
        error={errors.title}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="meeting-start"
          label="Date et heure"
          type="datetime-local"
          value={values.startsAt}
          onChange={set("startsAt")}
          error={errors.startsAt}
        />
        <FormField
          id="meeting-location"
          label="Lieu"
          value={values.location}
          onChange={set("location")}
        />
      </div>
      <FieldShell id="meeting-agenda" label="Ordre du jour" error={errors.agenda}>
        {(aria) => <Textarea {...aria} rows={4} value={values.agenda} onChange={set("agenda")} />}
      </FieldShell>
      {props.mode === "edit" ? (
        <FieldShell id="meeting-minutes" label="Compte rendu" error={errors.minutes}>
          {(aria) => (
            <Textarea {...aria} rows={8} value={values.minutes} onChange={set("minutes")} />
          )}
        </FieldShell>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {props.mode === "create" ? "Créer la réunion" : "Enregistrer"}
      </Button>
    </form>
  );
}
