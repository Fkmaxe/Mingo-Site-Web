import { type CustomFieldDef, type CustomFieldType, fieldKey, isChoiceField } from "@bde/shared";

/** Form state of the questions of an event or of the application form. */
export type CustomFieldFormValues = {
  /** Kept for existing fields (answers are stored under it); empty for new ones. */
  key: string;
  label: string;
  /** Shown under the label, line breaks kept. */
  description: string;
  type: CustomFieldType;
  required: boolean;
  /** Choices of a choice field, one per line. */
  options: string;
  allowOther: boolean;
};

export const emptyCustomField = (): CustomFieldFormValues => ({
  key: "",
  label: "",
  description: "",
  type: "text",
  required: false,
  options: "",
  allowOther: false,
});

/** Existing keys are kept; new fields get a key from their label, made unique. */
/**
 * Keys of the rows: an existing one is kept (answers are stored under it), a new row gets one
 * from its label, made unique (« taille », « taille_2 »…).
 */
export function uniqueKeys(rows: { key: string; label: string }[], fallback: string): string[] {
  const used = new Set(rows.map((r) => r.key).filter(Boolean));
  return rows.map((row) => {
    if (row.key) return row.key;
    const base = fieldKey(row.label || fallback);
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base.slice(0, 36)}_${n}`;
    used.add(key);
    return key;
  });
}

export function toCustomFields(rows: CustomFieldFormValues[]) {
  const keys = uniqueKeys(rows, "champ");
  return rows.map((row, index) => {
    const key = keys[index] ?? row.key;
    const options = row.options
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    return {
      key,
      label: row.label,
      ...(row.description.trim() ? { description: row.description } : {}),
      type: row.type,
      required: row.required,
      ...(isChoiceField(row.type)
        ? { options, ...(row.allowOther ? { allowOther: true } : {}) }
        : {}),
    };
  });
}

/** Saved questions -> form state. */
export function fromCustomFields(fields: CustomFieldDef[]): CustomFieldFormValues[] {
  return fields.map((f) => ({
    key: f.key,
    label: f.label,
    description: f.description ?? "",
    type: f.type,
    required: f.required,
    options: (f.options ?? []).join("\n"),
    allowOther: f.allowOther ?? false,
  }));
}
