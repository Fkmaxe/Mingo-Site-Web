"use client";

import { type AnswerValue, answersSchema, type CustomFieldDef } from "@bde/shared";
import { useState } from "react";
import { FieldShell } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

type Props = {
  fields: CustomFieldDef[];
  submitLabel: string;
  pending: boolean;
  serverErrors?: Record<string, string> | undefined;
  onSubmit: (answers: Record<string, AnswerValue>) => void;
  onCancel: () => void;
};

/** The event's questions, validated with the same schema as the API. */
export function AnswersForm({
  fields,
  submitLabel,
  pending,
  serverErrors,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shownErrors = { ...serverErrors, ...errors };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const answers: Record<string, unknown> = {};
    for (const field of fields) {
      const value = values[field.key];
      if (field.type === "checkbox") answers[field.key] = value === true;
      else if (value === undefined || value === "") continue;
      else answers[field.key] = field.type === "number" ? Number(value) : value;
    }
    const result = answersSchema(fields).safeParse(answers);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    onSubmit(result.data as Record<string, AnswerValue>);
  };

  const set = (key: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {fields.map((field) => {
        const id = `answer-${field.key}`;
        const label = field.required ? `${field.label} *` : field.label;
        const error = shownErrors[field.key];
        if (field.type === "checkbox") {
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  id={id}
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={values[field.key] === true}
                  onChange={(e) => set(field.key, e.target.checked)}
                  aria-invalid={error ? true : undefined}
                />
                {label}
              </label>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </div>
          );
        }
        return (
          <FieldShell key={field.key} id={id} label={label} error={error}>
            {(aria) =>
              field.type === "select" ? (
                <NativeSelect
                  {...aria}
                  value={String(values[field.key] ?? "")}
                  onChange={(e) => set(field.key, e.target.value)}
                >
                  <option value="">Choisir…</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input
                  {...aria}
                  type={field.type === "number" ? "number" : "text"}
                  inputMode={field.type === "number" ? "decimal" : undefined}
                  value={String(values[field.key] ?? "")}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              )
            }
          </FieldShell>
        );
      })}
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending ? "Un instant…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>
          Retour
        </Button>
      </div>
    </form>
  );
}
