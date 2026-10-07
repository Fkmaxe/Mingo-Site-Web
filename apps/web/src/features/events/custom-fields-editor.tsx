"use client";

import { CUSTOM_FIELD_TYPES, type CustomFieldType, MAX_CUSTOM_FIELDS } from "@bde/shared";
import { Plus, Trash2 } from "lucide-react";
import { type Control, type UseFormRegister, useFieldArray, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type EventFormValues, emptyCustomField } from "./event-form-values";

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texte libre",
  number: "Nombre",
  select: "Liste de choix",
  checkbox: "Case à cocher",
};

type Props = {
  control: Control<EventFormValues>;
  register: UseFormRegister<EventFormValues>;
  error?: string | undefined;
};

/** Questions asked at registration (t-shirt size, diet, in-game name…). */
export function CustomFieldsEditor({ control, register, error }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: "customFields" });
  const types = useWatch({ control, name: "customFields" });

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-medium text-sm">Questions à l'inscription</legend>
      <p className="text-muted-foreground text-xs">
        Taille de t-shirt, régime alimentaire, pseudo… Les réponses apparaissent dans la liste des
        inscrits et l'export CSV.
      </p>
      {fields.map((field, index) => {
        const id = `customFields-${index}`;
        return (
          <div key={field.id} className="flex flex-col gap-3 rounded-xl border p-3">
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor={`${id}-label`}>Question {index + 1}</Label>
                <Input id={`${id}-label`} {...register(`customFields.${index}.label`)} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Supprimer la question ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-type`}>Type de réponse</Label>
                <NativeSelect id={`${id}-type`} {...register(`customFields.${index}.type`)}>
                  {CUSTOM_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <label className="flex min-h-11 items-center gap-3 self-end text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  {...register(`customFields.${index}.required`)}
                />
                Obligatoire
              </label>
            </div>
            {types?.[index]?.type === "select" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-options`}>Choix (un par ligne)</Label>
                <Textarea
                  id={`${id}-options`}
                  rows={3}
                  className="min-h-20"
                  {...register(`customFields.${index}.options`)}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {fields.length < MAX_CUSTOM_FIELDS ? (
        <Button type="button" variant="outline" onClick={() => append(emptyCustomField())}>
          <Plus aria-hidden />
          Ajouter une question
        </Button>
      ) : null}
    </fieldset>
  );
}
