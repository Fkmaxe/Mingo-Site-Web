import { z } from "zod";

export const CUSTOM_FIELD_TYPES = ["text", "number", "select", "checkbox"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const MAX_CUSTOM_FIELDS = 10;

export const CustomFieldDef = z
  .object({
    /** Stable key of the answer, derived from the label when created. */
    key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Clé de champ invalide"),
    label: z.string().trim().min(1, "Le libellé est obligatoire").max(80, "Libellé trop long"),
    type: z.enum(CUSTOM_FIELD_TYPES, "Type de champ invalide"),
    required: z.boolean(),
    /** Choices of a `select` field. */
    options: z
      .array(z.string().trim().min(1, "Choix vide").max(60, "Choix trop long"))
      .max(30, "30 choix maximum")
      .optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === "select" && (field.options?.length ?? 0) < 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Indique au moins 2 choix" });
    }
  })
  .meta({ id: "CustomField" });
export type CustomFieldDef = z.infer<typeof CustomFieldDef>;

export const CustomFieldsSchema = z
  .array(CustomFieldDef)
  .max(MAX_CUSTOM_FIELDS, `${MAX_CUSTOM_FIELDS} champs maximum`)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    fields.forEach((field, index) => {
      if (seen.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "label"],
          message: "Deux champs portent le même nom",
        });
      }
      seen.add(field.key);
    });
  });

export type AnswerValue = string | number | boolean;
export type Answers = Record<string, AnswerValue>;

/** Turns a label into an answer key: "Taille de t-shirt" -> "taille_de_t_shirt". */
export function fieldKey(label: string): string {
  const key = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "");
  return /^[a-z]/.test(key) ? key : `champ_${key}`.slice(0, 40);
}

function answerSchema(field: CustomFieldDef): z.ZodType {
  switch (field.type) {
    case "text": {
      const text = z.string().trim().max(300, "Réponse trop longue (300 caractères max)");
      return field.required ? text.min(1, "Ce champ est obligatoire") : text.optional();
    }
    case "number": {
      const number = z.number("Indique un nombre");
      return field.required ? number : number.optional();
    }
    case "select": {
      const choice = z.enum((field.options ?? []) as [string, ...string[]], "Choix invalide");
      return field.required ? choice : choice.optional();
    }
    case "checkbox":
      return field.required
        ? z.literal(true, "Cette case doit être cochée")
        : z.boolean().optional();
  }
}

/** Zod schema validating a registration's answers against the event's fields. */
export function answersSchema(fields: CustomFieldDef[]) {
  return z.object(Object.fromEntries(fields.map((f) => [f.key, answerSchema(f)])));
}

/** Readable value for lists and exports. */
export function formatAnswer(value: AnswerValue | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  return String(value);
}
