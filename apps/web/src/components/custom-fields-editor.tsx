"use client";

import {
  CUSTOM_FIELD_TYPES,
  type CustomFieldType,
  isChoiceField,
  MAX_CUSTOM_FIELDS,
} from "@bde/shared";
import { Plus, Trash2 } from "lucide-react";
import {
  type ArrayPath,
  type Control,
  type FieldArray,
  type FieldValues,
  type Path,
  type UseFormRegister,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type CustomFieldFormValues, emptyCustomField } from "@/lib/custom-fields-form";

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texte court",
  longtext: "Texte long",
  number: "Nombre",
  select: "Choix unique",
  multiselect: "Choix multiples",
  checkbox: "Case à cocher",
};

/** A form holding its questions under `customFields`. */
type WithCustomFields = FieldValues & { customFields: CustomFieldFormValues[] };

type Props<T extends WithCustomFields> = {
  control: Control<T>;
  register: UseFormRegister<T>;
  legend: string;
  hint: string;
  max?: number;
  error?: string | undefined;
};

/** Questions of a form (event registration, application): label, explanation, type, choices. */
export function CustomFieldsEditor<T extends WithCustomFields>({
  control,
  register,
  legend,
  hint,
  max = MAX_CUSTOM_FIELDS,
  error,
}: Props<T>) {
  // The paths below exist in every form holding `customFields`: react-hook-form cannot infer
  // them through the generic.
  const name = "customFields" as ArrayPath<T>;
  const path = (index: number, key: keyof CustomFieldFormValues) =>
    `customFields.${index}.${key}` as Path<T>;
  const { fields, append, remove } = useFieldArray({ control, name });
  const types = useWatch({ control, name: name as Path<T> }) as CustomFieldFormValues[] | undefined;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-medium text-sm">{legend}</legend>
      <p className="text-muted-foreground text-xs">{hint}</p>
      {fields.map((field, index) => {
        const id = `customFields-${index}`;
        return (
          <div key={field.id} className="flex flex-col gap-3 rounded-xl border p-3">
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor={`${id}-label`}>Question {index + 1}</Label>
                <Textarea
                  id={`${id}-label`}
                  rows={1}
                  className="min-h-11"
                  {...register(path(index, "label"))}
                />
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
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-description`}>Explication (facultatif)</Label>
              <Textarea
                id={`${id}-description`}
                rows={2}
                className="min-h-16"
                placeholder={"Merci d'utiliser ce format :\n- Discord : @pseudo"}
                {...register(path(index, "description"))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-type`}>Type de réponse</Label>
                <NativeSelect id={`${id}-type`} {...register(path(index, "type"))}>
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
                  {...register(path(index, "required"))}
                />
                Obligatoire
              </label>
            </div>
            {isChoiceField(types?.[index]?.type ?? "text") ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-options`}>Choix (un par ligne)</Label>
                <Textarea
                  id={`${id}-options`}
                  rows={3}
                  className="min-h-20"
                  {...register(path(index, "options"))}
                />
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    {...register(path(index, "allowOther"))}
                  />
                  Proposer « Autre » avec une réponse libre
                </label>
              </div>
            ) : null}
          </div>
        );
      })}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {fields.length < max ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => append(emptyCustomField() as FieldArray<T, ArrayPath<T>>)}
        >
          <Plus aria-hidden />
          Ajouter une question
        </Button>
      ) : null}
    </fieldset>
  );
}
