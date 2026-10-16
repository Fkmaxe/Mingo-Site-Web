"use client";

import {
  APPLICATION_MAX_DOCUMENTS,
  APPLICATION_MAX_QUESTIONS,
  APPLICATION_MAX_WISHES,
  fieldKey,
  UpdateApplicationFormInput,
} from "@bde/shared";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { CustomFieldsEditor } from "@/components/custom-fields-editor";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  type CustomFieldFormValues,
  fromCustomFields,
  toCustomFields,
} from "@/lib/custom-fields-form";
import { isoToParisInput, parisInputToIso } from "@/lib/paris-time";
import { updateApplicationFormAction } from "./actions";
import type { ApplicationForm, ApplicationFormInput } from "./types";

type DocumentFormValues = {
  /** Kept for existing documents (handed-in files are stored under it); empty for new ones. */
  key: string;
  label: string;
  description: string;
  required: boolean;
  pdfOnly: boolean;
  allowLink: boolean;
};

type Values = {
  isOpen: boolean;
  closesAt: string;
  intro: string;
  maxWishes: string;
  allPolesRecruiting: boolean;
  recruitingPoleIds: string[];
  customFields: CustomFieldFormValues[];
  documents: DocumentFormValues[];
};

const emptyDocument = (): DocumentFormValues => ({
  key: "",
  label: "",
  description: "",
  required: true,
  pdfOnly: false,
  allowLink: false,
});

/** Existing keys are kept; new documents get a key from their label, made unique. */
function toDocuments(rows: DocumentFormValues[]) {
  const used = new Set(rows.map((r) => r.key).filter(Boolean));
  return rows.map((row) => {
    let key = row.key;
    if (!key) {
      const base = fieldKey(row.label || "document");
      key = base;
      for (let n = 2; used.has(key); n++) key = `${base.slice(0, 36)}_${n}`;
      used.add(key);
    }
    return {
      key,
      label: row.label,
      ...(row.description.trim() ? { description: row.description } : {}),
      required: row.required,
      pdfOnly: row.pdfOnly,
      allowLink: row.allowLink,
    };
  });
}

const PATH_LABELS: Record<string, string> = {
  closesAt: "Date limite",
  intro: "Texte d'accueil",
  recruitingPoleIds: "Pôles qui recrutent",
  fields: "Questions",
  documents: "Documents",
};

/**
 * The bureau's settings of the year's application form: opening and deadline, welcome text,
 * number of wishes, recruiting poles, questions and documents to hand in.
 */
export function ApplicationFormSettings({
  form,
  poles,
}: {
  form: ApplicationForm;
  poles: { id: string; name: string }[];
}) {
  const { control, register, handleSubmit, formState } = useForm<Values>({
    defaultValues: {
      isOpen: form.isOpen,
      closesAt: form.closesAt ? isoToParisInput(form.closesAt) : "",
      intro: form.intro,
      maxWishes: String(form.maxWishes),
      allPolesRecruiting: form.allPolesRecruiting,
      recruitingPoleIds: form.allPolesRecruiting ? [] : form.recruitingPoles.map((p) => p.id),
      customFields: fromCustomFields(form.fields),
      documents: form.documents.map((d) => ({ ...d, description: d.description ?? "" })),
    },
  });
  const documents = useFieldArray({ control, name: "documents" });
  const allPoles = useWatch({ control, name: "allPolesRecruiting" });
  const [result, setResult] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const submit = handleSubmit(async (values) => {
    const input: ApplicationFormInput = {
      isOpen: values.isOpen,
      closesAt: values.closesAt ? parisInputToIso(values.closesAt) : null,
      intro: values.intro,
      maxWishes: Number(values.maxWishes),
      allPolesRecruiting: values.allPolesRecruiting,
      recruitingPoleIds: values.allPolesRecruiting ? [] : values.recruitingPoleIds,
      fields: toCustomFields(values.customFields),
      documents: toDocuments(values.documents),
    };
    const parsed = UpdateApplicationFormInput.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = PATH_LABELS[String(issue?.path[0])];
      setResult({ tone: "error", text: `${where ? `${where} : ` : ""}${issue?.message ?? ""}` });
      return;
    }
    // The API validates and trims again.
    const saved = await updateApplicationFormAction(input);
    setResult(
      saved.ok
        ? { tone: "success", text: "Formulaire enregistré." }
        : { tone: "error", text: saved.message },
    );
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">Ouverture</h2>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-primary" {...register("isOpen")} />
          Candidatures ouvertes
        </label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="closes-at">Date limite (facultatif)</Label>
          <Input id="closes-at" type="datetime-local" {...register("closesAt")} />
          <p className="text-muted-foreground text-xs">
            Les candidatures se ferment toutes seules à cette heure (heure de Paris).
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="intro">Texte d'accueil</Label>
          <Textarea
            id="intro"
            rows={4}
            placeholder="Communication, sport, événementiel, partenariat : dis-nous où tu veux t'investir."
            {...register("intro")}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">Pôles</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="max-wishes">Nombre de vœux</Label>
          <NativeSelect id="max-wishes" {...register("maxWishes")}>
            {Array.from({ length: APPLICATION_MAX_WISHES }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Un seul pôle" : `${n} pôles classés`}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            {...register("allPolesRecruiting")}
          />
          Tous les pôles recrutent
        </label>
        {allPoles ? null : (
          <fieldset className="flex flex-col rounded-xl border px-3">
            <legend className="px-1 font-medium text-sm">Pôles qui recrutent</legend>
            {poles.map((p) => (
              <label key={p.id} className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  value={p.id}
                  className="size-5 accent-primary"
                  {...register("recruitingPoleIds")}
                />
                {p.name}
              </label>
            ))}
          </fieldset>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <CustomFieldsEditor
          control={control}
          register={register}
          legend="Questions"
          hint="Motivation, disponibilités, expérience… Les réponses apparaissent sur chaque candidature. Changer une question ne modifie pas les candidatures déjà envoyées."
          max={APPLICATION_MAX_QUESTIONS}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">Documents à remettre</h2>
        <p className="text-muted-foreground text-xs">
          CV, lettre, portfolio… Fichiers de 10 Mo au plus (photos, PDF, Word, Excel, PowerPoint,
          texte, CSV), ou un lien si tu l'autorises.
        </p>
        {documents.fields.map((field, index) => {
          const id = `documents-${index}`;
          return (
            <div key={field.id} className="flex flex-col gap-3 rounded-xl border p-3">
              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor={`${id}-label`}>Document {index + 1}</Label>
                  <Input
                    id={`${id}-label`}
                    placeholder="CV"
                    {...register(`documents.${index}.label`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Supprimer le document ${index + 1}`}
                  onClick={() => documents.remove(index)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-description`}>Explication (facultatif)</Label>
                <Textarea
                  id={`${id}-description`}
                  rows={2}
                  {...register(`documents.${index}.description`)}
                />
              </div>
              <div className="flex flex-col">
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    {...register(`documents.${index}.required`)}
                  />
                  Obligatoire
                </label>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    {...register(`documents.${index}.pdfOnly`)}
                  />
                  PDF seulement
                </label>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    {...register(`documents.${index}.allowLink`)}
                  />
                  Accepter un lien à la place (Drive, portfolio…)
                </label>
              </div>
            </div>
          );
        })}
        {documents.fields.length < APPLICATION_MAX_DOCUMENTS ? (
          <Button type="button" variant="outline" onClick={() => documents.append(emptyDocument())}>
            <Plus aria-hidden />
            Ajouter un document
          </Button>
        ) : null}
      </section>

      {result ? <FormAlert tone={result.tone}>{result.text}</FormAlert> : null}
      <Button type="submit" size="lg" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? "Enregistrement…" : "Enregistrer le formulaire"}
      </Button>
    </form>
  );
}
