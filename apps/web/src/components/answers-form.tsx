"use client";

import { type AnswerValue, answersSchema, type CustomFieldDef } from "@bde/shared";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  fields: CustomFieldDef[];
  submitLabel: string;
  pending: boolean;
  serverErrors?: Record<string, string> | undefined;
  onSubmit: (answers: Record<string, AnswerValue>) => void;
  /** Shows a « Retour » button. */
  onCancel?: () => void;
  /** Shown before the questions (other inputs of the same form). */
  children?: ReactNode;
};

/** Value of the "Autre" choice while its free text is typed in a separate input. */
const OTHER = "\u0000other";

type Value = string | boolean | string[];

/** Form state -> answers as the API expects them ("Autre" replaced by its text). */
function toAnswers(
  fields: CustomFieldDef[],
  values: Record<string, Value>,
  other: Record<string, string>,
) {
  const answers: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key];
    const otherText = other[field.key] ?? "";
    if (field.type === "checkbox") answers[field.key] = value === true;
    else if (field.type === "multiselect") {
      const list = Array.isArray(value) ? value.map((v) => (v === OTHER ? otherText : v)) : [];
      if (list.length > 0 || field.required) answers[field.key] = list;
    } else if (value === undefined || value === "") continue;
    else if (value === OTHER) answers[field.key] = otherText;
    else answers[field.key] = field.type === "number" ? Number(value) : value;
  }
  return answers;
}

/** Questions of an event or of the application form, validated with the API's schema. */
export function AnswersForm({
  fields,
  submitLabel,
  pending,
  serverErrors,
  onSubmit,
  onCancel,
  children,
}: Props) {
  const [values, setValues] = useState<Record<string, Value>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shownErrors = { ...serverErrors, ...errors };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = answersSchema(fields).safeParse(toAnswers(fields, values, other));
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    onSubmit(result.data as Record<string, AnswerValue>);
  };

  const set = (key: string, value: Value) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {children}
      {fields.map((field) => (
        <Question
          key={field.key}
          field={field}
          value={values[field.key]}
          otherText={other[field.key] ?? ""}
          error={shownErrors[field.key]}
          onChange={(value) => set(field.key, value)}
          onOtherChange={(text) => setOther((current) => ({ ...current, [field.key]: text }))}
        />
      ))}
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending ? "Un instant…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" size="lg" onClick={onCancel}>
            Retour
          </Button>
        ) : null}
      </div>
    </form>
  );
}

type QuestionProps = {
  field: CustomFieldDef;
  value: Value | undefined;
  otherText: string;
  error: string | undefined;
  onChange: (value: Value) => void;
  onOtherChange: (text: string) => void;
};

/** One question: label, explanation (line breaks kept), control, error. */
function Question({ field, value, otherText, error, onChange, onOtherChange }: QuestionProps) {
  const id = `answer-${field.key}`;
  const label = field.required ? `${field.label} *` : field.label;
  const descriptionId = field.description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const aria = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
  };
  const description = field.description ? (
    <p id={descriptionId} className="whitespace-pre-line text-muted-foreground text-sm">
      {field.description}
    </p>
  ) : null;
  const errorText = error ? (
    <p id={errorId} className="text-destructive text-sm">
      {error}
    </p>
  ) : null;

  if (field.type === "checkbox") {
    return (
      <div className="flex flex-col gap-1">
        {description}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            id={id}
            type="checkbox"
            className="size-5 shrink-0 accent-primary"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            {...aria}
          />
          <span className="whitespace-pre-line">{label}</span>
        </label>
        {errorText}
      </div>
    );
  }

  if (field.type === "select" || field.type === "multiselect") {
    const multiple = field.type === "multiselect";
    const selected = multiple ? (Array.isArray(value) ? value : []) : [value];
    const choices = [...(field.options ?? []), ...(field.allowOther ? [OTHER] : [])];
    const toggle = (choice: string, checked: boolean) => {
      if (!multiple) return onChange(choice);
      const list = Array.isArray(value) ? value : [];
      onChange(checked ? [...list, choice] : list.filter((c) => c !== choice));
    };
    return (
      <fieldset className="flex flex-col gap-2" {...aria}>
        <legend className="mb-2 whitespace-pre-line font-medium text-sm">{label}</legend>
        {description}
        <div className="flex flex-col">
          {choices.map((choice) => (
            <label key={choice} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type={multiple ? "checkbox" : "radio"}
                name={id}
                value={choice}
                className="size-5 shrink-0 accent-primary"
                checked={selected.includes(choice)}
                onChange={(e) => toggle(choice, e.target.checked)}
              />
              {choice === OTHER ? "Autre" : choice}
            </label>
          ))}
        </div>
        {selected.includes(OTHER) ? (
          <Input
            aria-label={`${field.label} : autre réponse`}
            value={otherText}
            maxLength={100}
            onChange={(e) => onOtherChange(e.target.value)}
          />
        ) : null}
        {errorText}
      </fieldset>
    );
  }

  const text = typeof value === "string" ? value : "";
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="whitespace-pre-line">
        {label}
      </Label>
      {description}
      {field.type === "longtext" ? (
        <Textarea
          id={id}
          rows={4}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          {...aria}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : "text"}
          inputMode={field.type === "number" ? "decimal" : undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          {...aria}
        />
      )}
      {errorText}
    </div>
  );
}
